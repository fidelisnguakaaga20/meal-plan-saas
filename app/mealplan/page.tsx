"use client";

import { Spinner } from "@/components/spinner";
import { useMutation } from "@tanstack/react-query";

type MealPlanInput = {
  dietType: string;
  calories: number;
  allergies: string;
  cuisine: string;
  snacks: boolean;
  days: number;
};

interface DailyMealPlan {
  Breakfast?: string;
  Lunch?: string;
  Dinner?: string;
  Snacks?: string;
}

type WeeklyMealPlan = Record<string, DailyMealPlan>;

interface MealPlanResponse {
  mealPlan?: WeeklyMealPlan;
  error?: string;
}

async function generateMealPlan(payload: MealPlanInput) {
  const res = await fetch("/api/generate-mealplan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<MealPlanResponse>;
}

export default function MealPlanDashboard() {
  const { mutate, isPending, data, isSuccess } = useMutation<
    MealPlanResponse,
    Error,
    MealPlanInput
  >({
    mutationFn: generateMealPlan,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const payload: MealPlanInput = {
      dietType: (formData.get("dietType") || "").toString(),
      calories: Number(formData.get("calories") || 0),
      allergies: (formData.get("allergies") || "").toString(),
      cuisine: (formData.get("cuisine") || "").toString(),
      snacks: !!formData.get("snacks"),
      days: 7,
    };

    mutate(payload);
  }

  const daysOfTheWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const getMealPlanForDay = (day: string): DailyMealPlan | undefined => {
    if (!data?.mealPlan) return undefined;
    return data.mealPlan[day];
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex flex-col md:flex-row bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Left panel (form) */}
        <div className="w-full md:w-1/3 lg:w-1/4 p-6 bg-emerald-500 text-white">
          <h1 className="text-2xl font-bold mb-6 text-center">AI Meal Plan Generator</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dietType" className="block text-sm font-medium mb-1">
                Diet Type
              </label>
              <input
                type="text"
                id="dietType"
                name="dietType"
                required
                className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., Vegetarian, Keto, Mediterranean"
              />
            </div>

            <div>
              <label htmlFor="calories" className="block text-sm font-medium mb-1">
                Daily Calorie Goal
              </label>
              <input
                type="number"
                id="calories"
                name="calories"
                required
                min={500}
                max={5000}
                className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., 2000"
              />
            </div>

            <div>
              <label htmlFor="allergies" className="block text-sm font-medium mb-1">
                Allergies or Restrictions
              </label>
              <input
                type="text"
                id="allergies"
                name="allergies"
                required
                className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., Nuts, Dairy, None"
              />
            </div>

            <div>
              <label htmlFor="cuisine" className="block text-sm font-medium mb-1">
                Preferred Cuisine
              </label>
              <input
                type="text"
                id="cuisine"
                name="cuisine"
                required
                className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., Italian, Chinese, No Preference"
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="snacks" name="snacks" className="h-4 w-4" />
              <label htmlFor="snacks" className="text-sm">
                Include Snacks
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 font-medium py-2 rounded-md transition"
            >
              {isPending ? "Generating..." : "Generate Meal Plan"}
            </button>
          </form>
        </div>

        {/* Right panel (results) */}
        <div className="flex-1 p-6">
          <h2 className="text-emerald-700 text-2xl font-semibold">Weekly Meal Plan</h2>

          {isSuccess && data?.mealPlan ? (
            <div className="h-[680px] overflow-y-auto">
              <div className="space-y-6">
                {daysOfTheWeek.map((day, key) => {
                  const mealPlan = getMealPlanForDay(day);
                  return (
                    <div
                      key={key}
                      className="bg-white shadow-md rounded-lg p-4 border border-emerald-200"
                    >
                      <h3 className="text-xl font-semibold mb-2 text-emerald-600">{day}</h3>

                      {mealPlan ? (
                        <div className="space-y-2">
                          <div>
                            <strong>Breakfast:</strong> {mealPlan.Breakfast ?? ""}
                          </div>
                          <div>
                            <strong>Lunch:</strong> {mealPlan.Lunch ?? ""}
                          </div>
                          <div>
                            <strong>Dinner:</strong> {mealPlan.Dinner ?? ""}
                          </div>
                          {mealPlan.Snacks && (
                            <div>
                              <strong>Snacks:</strong> {mealPlan.Snacks}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500">No meal plan available.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : isPending ? (
            <div className="flex justify-center items-center h-full">
              <Spinner />
            </div>
          ) : (
            <p className="text-gray-600">Please generate a meal plan to see it here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
