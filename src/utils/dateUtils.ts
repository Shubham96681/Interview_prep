export const formatDate = (d: string) => {
  const dt = new Date(d);
  // Format: "Mon, Jan 15" for better readability
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
  const month = dt.toLocaleDateString("en-US", { month: "short" });
  const day = dt.getDate();
  return `${weekday}, ${month} ${day}`;
};

export const normalizeDate = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  // Use local time instead of UTC to avoid timezone issues
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

