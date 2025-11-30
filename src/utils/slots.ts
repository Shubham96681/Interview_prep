// Slot Utilities

export const SLOT_DURATION = 60;

export const START = "09:00";

export const END = "21:00";

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export const normalize = (t: string) => {
  const [h, m = "00"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

export const generateSlots = () => {
  const arr: string[] = [];
  let cur = toMinutes(START);
  const end = toMinutes(END);

  while (cur < end) {
    arr.push(toTime(cur));
    cur += SLOT_DURATION;
  }

  return arr;
};

export const computeAvailable = (
  all: string[],
  booked: string[],
  disabled: string[]
) => {
  const bookedSet = new Set(booked.map(normalize));
  const disabledSet = new Set(disabled.map(normalize));

  const available = all.filter((t) => {
    const n = normalize(t);
    return !bookedSet.has(n) && !disabledSet.has(n);
  });

  return {
    available,
    count: available.length,
  };
};

