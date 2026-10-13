// Layout and rules shared by the world, the navigation grid and the NPC director.
//
// The world is a chain of floating islands over a misty abyss, joined by stone bridges:
// Roundtable Hold (the hub) in the middle, and one region per project alternating east and
// west of it. Station positions below are local to a region's centre; slots are
// [x, z, facing] where facing is 1 (right) or -1 (left).

export const PX = 1 / 12; // world units per sprite pixel (sprites read a little chunkier than the 16-texel world)

export const REGION = {
  halfW: 16,       // half width of a region island
  minZ: -11,       // back edge (behind the wall)
  maxZ: 10,        // front edge (the cliff the camera looks over)
  walk: { minX: -14.6, maxX: 14.6, minZ: -9.0, maxZ: 8.6 },
};
export const HUB = { radius: 11, walkRadius: 10.2 };
// The Arena of Trials, north of the Hold (arena.js): where great enemies are fought.
export const ARENA = { z: -40, radius: 14, walkRadius: 12.6, bridgeHalf: 1.15 };
export const BRIDGE = { z: 0.6, halfWidth: 1.15, gap: 6 };
export const FAST_TRAVEL = { urgent: 20, leisure: 60 };

// Centre x of the island in a slot: 0 is the hub, then 1 → east, 2 → west, 3 → further east…
export function slotCenterX(slot) {
  if (slot === 0) return 0;
  const side = slot % 2 === 1 ? 1 : -1;
  const rank = Math.ceil(slot / 2);
  const first = HUB.radius + BRIDGE.gap + REGION.halfW;
  return side * (first + (rank - 1) * (2 * REGION.halfW + BRIDGE.gap));
}

// The island one step closer to the hub (for bridges).
export function innerSlot(slot) {
  return slot <= 2 ? 0 : slot - 2;
}

const ring = (cx, cz, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r * 0.8;
    return [x, z, x < cx ? 1 : -1];
  });

export const STATIONS = {
  grace: {
    name: 'Site of Grace',
    pos: [0, -2.6],
    slots: ring(0, -2.6, 1.6, 8),
  },
  forge: {
    name: 'the Forge',
    verb: 'takes up the hammer',
    anim: 'hammer',
    pos: [-8.2, -5.0],
    slots: [[-9.4, -4.3, 1], [-7.0, -4.3, -1], [-8.2, -3.5, 1]],
  },
  scriptorium: {
    name: 'the Scriptorium',
    verb: 'pores over the scrolls',
    anim: 'read',
    pos: [-11.6, 0.6],
    slots: [[-12.6, 0.1, 1], [-10.6, 0.1, -1], [-10.5, 2.2, -1], [-12.7, 2.2, 1]],
  },
  table: {
    name: 'the War Table',
    verb: 'plots upon the war table',
    anim: 'point',
    pos: [-4.6, 4.6],
    slots: [[-6.4, 4.7, 1], [-2.8, 4.7, -1], [-4.0, 5.9, -1], [-5.4, 5.9, 1]],
  },
  ritual: {
    name: 'the Ritual Circle',
    verb: 'invokes the ritual circle',
    anim: 'cast',
    pos: [8.6, 0.6],
    slots: [[7.2, 1.0, 1], [10.0, 1.0, -1], [8.6, 2.2, 1], [8.6, -0.6, -1]],
  },
  tower: {
    name: 'the Raven Tower',
    verb: 'dispatches a raven',
    anim: 'send',
    pos: [11.8, -6.8],
    slots: [[10.3, -4.2, 1], [12.6, -4.0, -1], [9.4, -5.3, 1]],
  },
  gate: {
    name: 'the Fog Gate',
    pos: [0, -10],
    slots: [[-1.3, -7.4, 1], [1.3, -7.4, -1], [0, -6.6, 1], [-2.5, -6.4, 1], [2.5, -6.4, -1], [-3.4, -7.3, 1]],
    exit: [0, -9.0],
  },
};

// Seats around the round table at Roundtable Hold, where idle Tarnished from every project meet.
export const HUB_LAYOUT = {
  grace: [0, -5.6],
  table: [0, 0.6],
  seats: Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const x = Math.cos(a) * 3.1;
    const z = 0.6 + Math.sin(a) * 2.3;
    return [x, z, x < 0 ? 1 : -1];
  }),
};

const TOOL_STATION = {
  Edit: 'forge', Write: 'forge', MultiEdit: 'forge', NotebookEdit: 'forge',
  Read: 'scriptorium', Grep: 'scriptorium', Glob: 'scriptorium', LS: 'scriptorium', NotebookRead: 'scriptorium',
  LSP: 'scriptorium', ToolSearch: 'scriptorium', ListMcpResourcesTool: 'scriptorium', ReadMcpResourceTool: 'scriptorium',
  Bash: 'ritual', PowerShell: 'ritual', BashOutput: 'ritual', KillShell: 'ritual', KillBash: 'ritual',
  Monitor: 'ritual', TaskStop: 'ritual', TaskOutput: 'ritual',
  WebSearch: 'tower', WebFetch: 'tower', SendMessage: 'tower', PushNotification: 'tower', SendUserFile: 'tower',
  Artifact: 'tower', RemoteTrigger: 'tower',
  TodoWrite: 'table', TaskCreate: 'table', TaskUpdate: 'table', TaskList: 'table', TaskGet: 'table',
  EnterPlanMode: 'table', ExitPlanMode: 'table', AskUserQuestion: 'table', Workflow: 'table',
  CronCreate: 'table', CronList: 'table', CronDelete: 'table', ScheduleWakeup: 'table',
};

// Returns a station id, 'summon' (spawns spirit ashes), or 'cast' (works in place).
export function stationForTool(tool) {
  if (!tool) return 'cast';
  if (tool === 'Agent' || tool === 'Task') return 'summon';
  if (TOOL_STATION[tool]) return TOOL_STATION[tool];
  if (tool.startsWith('mcp__')) return 'tower';
  return 'cast';
}

export const STATION_LABEL = {
  forge: 'Forge', scriptorium: 'Scriptorium', table: 'War Table', ritual: 'Ritual Circle',
  tower: 'Raven Tower', summon: 'Summoning', cast: 'Incantation', grace: 'Grace', gate: 'Fog Gate',
};

export const TIMING = {
  restAtGrace: 25,        // seconds a finished session sits at grace before wandering
  chatCooldown: [22, 55], // seconds between conversations for one NPC
  visitAfter: 35,         // seconds of idleness before a Tarnished may wander off to Roundtable Hold
  visitStay: [50, 130],   // seconds spent at the round table
};
