/**
 * Waypoint data for the Ao Tai (鳌太) traverse route.
 * 13 waypoints from Tangkou trailhead (1740m) to Baxian Platform summit (3767m).
 * Based on the real Qinling Mountains route in Shaanxi Province, China.
 */

import type { Waypoint } from "../engine/types.ts";

export const WAYPOINTS: Waypoint[] = [
  {
    id: "tangkou",
    name: "Tangkou",
    nameCN: "塘口",
    elevation: 1740,
    distanceFromStart: 0,
    terrain: "stream_valley",
    canCamp: true,
    shelterAvailable: true,
    description:
      "A sheltered valley trailhead where mountain streams converge beneath a canopy of mixed broadleaf forest.",
  },
  {
    id: "xihuagou",
    name: "West Flower Valley",
    nameCN: "西花沟",
    elevation: 2400,
    distanceFromStart: 8,
    terrain: "forest",
    canCamp: false,
    shelterAvailable: false,
    description:
      "Dense coniferous forest draped in moss and ferns, where the trail switchbacks steeply through rhododendron thickets.",
  },
  {
    id: "camp_2900",
    name: "2900 Camp",
    nameCN: "2900营地",
    elevation: 2900,
    distanceFromStart: 15,
    terrain: "forest",
    canCamp: true,
    shelterAvailable: true,
    description:
      "A well-known staging camp at the upper tree line, offering flat ground and wind shelter among the last standing firs.",
  },
  {
    id: "bonsai_garden",
    name: "Bonsai Garden",
    nameCN: "盆景园",
    elevation: 3276,
    distanceFromStart: 22,
    terrain: "meadow",
    canCamp: true,
    shelterAvailable: false,
    description:
      "An alpine meadow studded with wind-sculpted dwarf trees resembling natural bonsai, exposed to shifting cloud banks.",
  },
  {
    id: "daohangja",
    name: "Navigation Tower",
    nameCN: "导航架",
    elevation: 3431,
    distanceFromStart: 28,
    terrain: "ridge",
    canCamp: false,
    shelterAvailable: false,
    description:
      "A narrow exposed ridge marked by a rusted metal navigation tower, battered by crosswinds from both valleys below.",
  },
  {
    id: "yaowangmiao",
    name: "Medicine King Temple",
    nameCN: "药王庙",
    elevation: 3327,
    distanceFromStart: 33,
    terrain: "stone_sea",
    canCamp: false,
    shelterAvailable: true,
    description:
      "Ruins of an ancient temple dedicated to Sun Simiao amid a vast boulder field, offering minimal but welcome shelter.",
  },
  {
    id: "maijianliang",
    name: "Wheat Straw Ridge",
    nameCN: "麦秸梁",
    elevation: 3528,
    distanceFromStart: 38,
    terrain: "ridge",
    canCamp: false,
    shelterAvailable: false,
    description:
      "A long, knife-edge ridge with golden dead grass that sways like wheat fields, fully exposed to brutal high-altitude winds.",
  },
  {
    id: "shuiwo",
    name: "Water Pit Camp",
    nameCN: "水窝子",
    elevation: 3235,
    distanceFromStart: 45,
    terrain: "meadow",
    canCamp: true,
    shelterAvailable: false,
    description:
      "A boggy alpine depression where snowmelt collects in shallow pools, the only reliable water source for many kilometers.",
  },
  {
    id: "feijiliang",
    name: "Airplane Ridge",
    nameCN: "飞机梁",
    elevation: 3400,
    distanceFromStart: 52,
    terrain: "scree",
    canCamp: false,
    shelterAvailable: false,
    description:
      "A desolate scree slope named for a crashed military aircraft, where loose rock shifts underfoot with every step.",
  },
  {
    id: "camp_2800",
    name: "2800 Camp",
    nameCN: "2800营地",
    elevation: 2800,
    distanceFromStart: 58,
    terrain: "meadow",
    canCamp: true,
    shelterAvailable: true,
    description:
      "A protected campsite in a lush meadow bowl below the high ridges, with reliable water and flat tent platforms.",
  },
  {
    id: "nantianmen",
    name: "South Heaven Gate",
    nameCN: "南天门",
    elevation: 3300,
    distanceFromStart: 65,
    terrain: "ridge",
    canCamp: true,
    shelterAvailable: false,
    description:
      "A dramatic cleft in the ridgeline where the trail passes through a natural rock gateway above the cloud sea.",
  },
  {
    id: "taibailiang",
    name: "Taibai Ridge",
    nameCN: "太白梁",
    elevation: 3523,
    distanceFromStart: 72,
    terrain: "ridge",
    canCamp: false,
    shelterAvailable: false,
    description:
      "The final exposed ridge leading toward the summit, a relentless undulating traverse above the permanent snow line.",
  },
  {
    id: "baxiantai",
    name: "Baxian Platform",
    nameCN: "拔仙台",
    elevation: 3767,
    distanceFromStart: 80,
    terrain: "summit",
    canCamp: false,
    shelterAvailable: false,
    description:
      "The highest point of Mount Taibai and the entire Qinling range, a windswept platform where heaven meets earth.",
  },
];
