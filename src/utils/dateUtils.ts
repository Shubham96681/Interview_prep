export const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const normalizeDate = (d: string) => {
  const dt = new Date(d);
  return dt.toISOString().split("T")[0];
};

