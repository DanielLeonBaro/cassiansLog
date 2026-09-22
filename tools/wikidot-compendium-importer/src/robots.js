function lines(body) {
  return String(body || "").split(/\r?\n/).map((line) => line.replace(/#.*$/, "").trim()).filter(Boolean);
}

export function parseRobots(body) {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const line of lines(body)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && agents.length) {
      rules.push({ type: field, path: value });
    }
  }
  flush();
  return groups;
}

export function robotsAllows(body, url, userAgent = "wikidot-compendium-importer") {
  const parsed = parseRobots(body);
  const agent = userAgent.toLowerCase();
  const applicable = parsed.filter(({ agents }) => agents.some((value) => value === "*" || agent.includes(value)));
  const pathname = new URL(url).pathname || "/";
  const rules = applicable.flatMap(({ rules: groupRules }) => groupRules)
    .filter((rule) => rule.path && pathname.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length || (left.type === "allow" ? -1 : 1));
  return !rules.length || rules[0].type === "allow";
}
