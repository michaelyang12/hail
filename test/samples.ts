import type { BusAnswer, SubwayAnswer } from "../src/model";
import { stations } from "../src/stations";

export const subway: SubwayAnswer = {
  kind: "subway",
  line: "A",
  station: stations.find((s) => s.stopId === "A31")!,
  also: [],
  groups: [{ dir: "S", label: "Downtown", running: true, arrivals: [{ dir: "S", route: "A", secs: 70 }, { dir: "S", route: "A", secs: 610 }] }],
  ageSecs: 10,
};

export const bus: BusAnswer = {
  kind: "bus",
  route: { key: "M15", name: "M15", color: "006CB7", text: "FFFFFF" },
  groups: [
    {
      dir: "S",
      label: "South Ferry",
      stop: "2 Av/E 22 St",
      arrivals: [
        { dir: 1, route: "M15", secs: 10, stopsAway: 0, proximity: "at stop" },
        { dir: 1, route: "M15", secs: 190, stopsAway: 2, proximity: "2 stops away" },
      ],
    },
  ],
  also: [],
  ageSecs: 5,
};
