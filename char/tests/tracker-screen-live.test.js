import assert from "node:assert/strict";
import { createLiveTrackerAdapter } from "../js/tracker/screen-adapter.js";
import { createCombatDeskState, combatDeskStorageKey } from "../js/tracker/v6-model.js";
import { consumeV4ActionUse } from "../js/tracker/v4-actions.js";
import { consumeV4SpellCast } from "../js/tracker/v4-spells.js";
import { previewDocument } from "./previews/fixtures.js";
import { normalizeUiPreferences, validUiPreferences } from "../../shared/gc/preferences-model.js";
import { optionRecords, profile } from "../js/tracker/screen-view.js";

const character = previewDocument("caster"), notes = [];
character.actions = previewDocument("fighter").actions;
character.resources.push(...previewDocument("fighter").resources);
character.inventory.push({id:"manual-wand",name:"Manual wand",charges:{current:2,max:3}});
character.inventory.push({id:"automatic-wand",instanceId:"wand-1",name:"Supported wand",quantity:1,automatic:true,charges:{current:2,max:3}});
let editable = true, dispatched = 0;
const personal = createCombatDeskState();
const adapter = createLiveTrackerAdapter({ character, kind:"character", personal, canEdit:()=>editable,
  backHref:"/c/test/char/", notes:{getNotes:()=>notes}, trackerState:{getInventoryItemState:()=>({charges:{current:1}})},
  operations: {
    use:(id,optionId)=>{dispatched++;return consumeV4ActionUse(character,id,optionId);},
    cast:(id,selection)=>{dispatched++;return consumeV4SpellCast(character,id,selection);},
    charge:()=>{dispatched++;return {applied:true};},
    availableInCombat:spell=>spell.level===0||spell.prepared,
    canPrepare:()=>false,
    note:(title,body,index)=>{if(index===null)notes.push({title,body});else notes[index]={title,body};},
  },
});
const before = JSON.stringify(character);
adapter.plan("actions:sweep");
assert.equal(JSON.stringify(character),before,"Planning does not spend live data");
assert.equal(adapter.confirm("actions:sweep").applied,true);
assert.equal(character.resources.find(item=>item.id==="superiority").uses.current,2);
assert.equal(personal.turn.action,true);
assert.equal(dispatched,1,"Confirmation delegates once to existing engine");
assert.equal(adapter.confirm("spells:missile",{optionId:"slot:level-3"}).applied,true);
assert.equal(character.spellcasting.slots[2].current,0);
assert.equal(adapter.plan("inventory:manual-wand"),null,"Unsupported charge records open details");
assert.equal(adapter.plan("inventory:wand-1").canConfirm,true);
assert.equal(adapter.record("inventory:wand-1").item.charges.current,1,"Inventory reads tracker runtime rather than stale definitions");
assert.equal(adapter.confirm("inventory:wand-1").applied,true);
assert.equal(dispatched,3);
adapter.addNote("Title","Body",null);
assert.equal(adapter.character.notes[0].body,"Body");
character.name="Edited in full editor";adapter.refresh();
assert.equal(adapter.character.name,character.name,"Editor refresh updates the same presentation object");
assert.equal(adapter.character.backHref,"/c/test/char/");
assert.match(profile({...adapter.character,passivePerception:14,backstory:"Recorded backstory"}),/Recorded backstory/);
assert.equal(optionRecords(adapter,"play","","",{source:"spells",level:"2"}).every(item=>item.source==="spells"&&item.item.level===2),true);
editable=false;
const readOnly=JSON.stringify(character), calls=dispatched;
assert.equal(adapter.confirm("actions:sweep").applied,false);
assert.equal(adapter.hp("damage",5),false);
assert.equal(adapter.rest("long"),false);
adapter.addNote("No","No",null);adapter.toggleFlag("inspiration");adapter.refresh();
assert.equal(dispatched,calls);
assert.equal(JSON.stringify(character),readOnly);
assert.deepEqual(adapter.character.notes,[],"Private notes are absent from read-only presentation");
assert.equal(adapter.canEdit,false);
const privateNpc = createLiveTrackerAdapter({ character:{...character,portrait:"PRIVATE PORTRAIT",fly:60,darkvision:120,passivePerception:19}, kind:"npc", canEdit:()=>false, visibleFields:["walk","ac"], personal, notes:{getNotes:()=>[]}, trackerState:{getInventoryItemState:()=>({})}, operations:{} });
for (const field of ["portrait","fly","darkvision","passivePerception","proficiency"]) assert.equal(privateNpc.character[field],undefined, `Hidden NPC ${field} stays absent from combat info`);

for(const style of ["v1","v2","v3","v4","v5","v6","v2.1","v2.2"]){
  const preferences=normalizeUiPreferences({trackerStyles:{character:style,npc:style}});
  assert.equal(validUiPreferences(preferences),true);
  assert.equal(preferences.trackerStyles.character,style);
}
assert.deepEqual(normalizeUiPreferences().trackerStyles,{character:"v5",npc:"v5"},"Existing personal defaults remain unchanged");
assert.notEqual(combatDeskStorageKey({userId:"a",campaign:"c",kind:"npc",entityId:"x"}),combatDeskStorageKey({userId:"a",campaign:"c",kind:"character",entityId:"x"}));
console.log("Live screen adapter checks passed: shared command delegation, runtime inventory, private notes, read-only guards, refresh, filters, and additive style validation.");
