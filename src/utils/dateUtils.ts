export const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const normalizeDate = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  // Use local time instead of UTC to avoid timezone issues
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

