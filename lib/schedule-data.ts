import type { Meal } from "@/lib/food-data";

export type WeekdayId = "sat" | "sun" | "mon" | "tue" | "wed" | "thu" | "fri";

export type WeeklySchedule = {
  closedDays: WeekdayId[];
  mealDays: Record<string, WeekdayId[]>;
};

export type LocalizedDay = {
  id: WeekdayId;
  label: { ar: string; en: string };
};

export const weekdays: LocalizedDay[] = [
  { id: "sat", label: { ar: "السبت", en: "Saturday" } },
  { id: "sun", label: { ar: "الأحد", en: "Sunday" } },
  { id: "mon", label: { ar: "الإثنين", en: "Monday" } },
  { id: "tue", label: { ar: "الثلاثاء", en: "Tuesday" } },
  { id: "wed", label: { ar: "الأربعاء", en: "Wednesday" } },
  { id: "thu", label: { ar: "الخميس", en: "Thursday" } },
  { id: "fri", label: { ar: "الجمعة", en: "Friday" } },
];

export const createDefaultWeeklySchedule = (meals: Meal[]): WeeklySchedule => ({
  closedDays: [],
  mealDays: Object.fromEntries(meals.map((meal) => [meal.id, weekdays.map((day) => day.id)])),
});

export const getWeekdayFromDate = (date = new Date()): WeekdayId => {
  const day = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as WeekdayId[])[day];
};

export const isDayClosed = (schedule: WeeklySchedule, day: WeekdayId) => schedule.closedDays.includes(day);

export const isMealAvailableOnDay = (schedule: WeeklySchedule, mealId: string, day: WeekdayId) => {
  if (isDayClosed(schedule, day)) return false;
  return schedule.mealDays[mealId]?.includes(day) ?? true;
};

export const normalizeWeeklySchedule = (value: Partial<WeeklySchedule> | undefined, meals: Meal[]): WeeklySchedule => {
  const fallback = createDefaultWeeklySchedule(meals);
  const closedDays = Array.isArray(value?.closedDays) ? value.closedDays.filter((day): day is WeekdayId => weekdays.some((item) => item.id === day)) : fallback.closedDays;
  const mealDays = { ...fallback.mealDays };
  if (value?.mealDays && typeof value.mealDays === "object") {
    for (const meal of meals) {
      const days = value.mealDays[meal.id];
      if (Array.isArray(days)) mealDays[meal.id] = days.filter((day): day is WeekdayId => weekdays.some((item) => item.id === day));
    }
  }
  return { closedDays, mealDays };
};

export const weeklyScheduleToCsv = (schedule: WeeklySchedule, meals: Meal[]) => {
  const header = ["Meal", ...weekdays.map((day) => day.label.en), "Store status"].join(",");
  const rows = meals.map((meal) => {
    const mealDays = schedule.mealDays[meal.id] ?? [];
    const values = weekdays.map((day) => (isMealAvailableOnDay(schedule, meal.id, day.id) && mealDays.includes(day.id) ? "Available" : "Closed"));
    const storeStatus = schedule.closedDays.length === weekdays.length ? "Closed all week" : "Open on selected days";
    return [JSON.stringify(meal.name.en), ...values, storeStatus].join(",");
  });
  return `Sufret Omi weekly kitchen schedule\n${header}\n${rows.join("\n")}\n`;
};
