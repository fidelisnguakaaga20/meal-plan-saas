"use client";

import { Spinner } from "@/components/spinner";
import { useUser } from "@clerk/nextjs";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { availablePlans } from "@/lib/plans";
import { useState } from "react";
import { useRouter } from "next/navigation";

type SubTier = "WEEKLY" | "MONTHLY" | "YEARLY" | null;
type PlanKey = "week" | "month" | "year";

async function fetchSubscriptionStatus() {
  // ✅ Treat non-200s gracefully (API now returns 200 with inactive, but keep defensive)
  const res = await fetch("/api/profile/subscription-status", { cache: "no-store" });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { subscription: { subscriptionActive: false, subscriptionTier: null } };
  }
  return data;
}

async function updatePlan(newPlan: PlanKey) {
  const res = await fetch("/api/profile/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planType: newPlan }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Failed to change plan");
  return res.json();
}

async function unsubscribe() {
  const res = await fetch("/api/profile/unsubscribe", { method: "POST" });
  if (!res.ok) throw new Error((await res.text()) || "Failed to unsubscribe");
  return res.json();
}

export default function Profile() {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | "">("");
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: subscriptionResp,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscriptionStatus,
    enabled: isLoaded && isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  const subscription = subscriptionResp?.subscription ?? {
    subscriptionActive: false,
    subscriptionTier: null as SubTier,
  };

  const { mutate: updatePlanMutation, isPending: isUpdatePlanPending } = useMutation({
    mutationFn: updatePlan,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Subscription plan updated successfully");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Error updating plan");
    },
  });

  const { mutate: unsubscribeMutation, isPending: isUnsubscribePending } = useMutation({
    mutationFn: unsubscribe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      router.push("/subscribe");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Error unsubscribing.");
    },
  });

  // Normalize DB/webhook tier -> UI plan key
  const tierRaw = (subscription?.subscriptionTier ?? null) as SubTier;
  const normalized: PlanKey | null =
    tierRaw === "WEEKLY" ? "week" : tierRaw === "MONTHLY" ? "month" : tierRaw === "YEARLY" ? "year" : null;

  const currentPlan = availablePlans.find((p) => p.interval === normalized);

  function handleUpdatePlan() {
    if (selectedPlan) {
      updatePlanMutation(selectedPlan as PlanKey);
      setSelectedPlan("");
    }
  }

  function handleUnsubscribe() {
    if (confirm("Are you sure you want to unsubscribe? You will lose premium features.")) {
      unsubscribeMutation();
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-emerald-100">
        <Spinner /> <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-emerald-100">
        <p>Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-100 p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-5xl bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left column (profile card) */}
          <div className="w-full md:w-1/3 p-6 bg-emerald-500 text-white flex flex-col items-center">
            {user.imageUrl && (
              <Image
                src={user.imageUrl}
                alt="User Avatar"
                width={100}
                height={100}
                className="rounded-full mb-4"
                // Optional: prioritize LCP of avatar
                priority
              />
            )}
            <h1 className="text-2xl font-bold mb-2">
              {user.firstName} {user.lastName}
            </h1>
            <p className="mb-4">{user.primaryEmailAddress?.emailAddress}</p>
          </div>

          {/* Right column (stack of cards) */}
          <div className="w-full md:w-2/3 p-6 bg-gray-50">
            <h2 className="text-2xl font-bold mb-6 text-emerald-700">Subscription Details</h2>

            {isLoading ? (
              <div className="flex items-center">
                <Spinner /> <span className="ml-2">Loading subscription details...</span>
              </div>
            ) : isError ? (
              <p className="text-red-500">Could not load subscription – please refresh.</p>
            ) : subscription?.subscriptionActive && currentPlan ? (
              <div className="space-y-6">
                {/* Current Plan card */}
                <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                  <h3 className="text-xl font-semibold mb-2 text-emerald-600">Current Plan</h3>
                  <p><strong>Plan: </strong>{currentPlan.name}</p>
                  <p><strong>Amount: </strong>${currentPlan.amount} {currentPlan.currency}</p>
                  <p><strong>Status: </strong>Active</p>
                </div>

                {/* Change Subscription Plan card */}
                <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                  <h3 className="text-xl font-semibold mb-2 text-emerald-600">Change Subscription Plan</h3>
                  <select
                    defaultValue={currentPlan.interval}
                    disabled={isUpdatePlanPending}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSelectedPlan(e.target.value as PlanKey | "")
                    }
                    className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none"
                  >
                    <option value="">Select a New Plan</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.interval} value={plan.interval}>
                        {plan.name} - ${plan.amount} / {plan.interval}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleUpdatePlan}
                    disabled={isUpdatePlanPending || !selectedPlan}
                    className="mt-3 p-2 bg-emerald-500 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatePlanPending ? "Updating..." : "Save Change"}
                  </button>
                </div>

                {/* Unsubscribe card */}
                <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                  <h3 className="text-xl font-semibold mb-2 text-emerald-600">Unsubscribe</h3>
                  <button
                    onClick={handleUnsubscribe}
                    disabled={isUnsubscribePending}
                    className={`w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors ${
                      isUnsubscribePending ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isUnsubscribePending ? "Unsubscribing..." : "Unsubscribe"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-700">You are not subscribed to any plan.</p>
                <button
                  onClick={() => router.push("/subscribe")}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// "use client";

// import { Spinner } from "@/components/spinner";
// import { useUser } from "@clerk/nextjs";
// import toast, { Toaster } from "react-hot-toast";
// import Image from "next/image";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { availablePlans } from "@/lib/plans";
// import { useState } from "react";
// import { useRouter } from "next/navigation";

// type SubTier = "WEEKLY" | "MONTHLY" | "YEARLY" | null;
// type PlanKey = "week" | "month" | "year";

// async function fetchSubscriptionStatus() {
//   const res = await fetch("/api/profile/subscription-status", { cache: "no-store" });
//   if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
//   return res.json();
// }

// async function updatePlan(newPlan: PlanKey) {
//   const res = await fetch("/api/profile/change-plan", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     // server expects { planType: "week" | "month" | "year" }
//     body: JSON.stringify({ planType: newPlan }),
//   });
//   if (!res.ok) throw new Error((await res.text()) || "Failed to change plan");
//   return res.json();
// }

// async function unsubscribe() {
//   const res = await fetch("/api/profile/unsubscribe", { method: "POST" });
//   if (!res.ok) throw new Error((await res.text()) || "Failed to unsubscribe");
//   return res.json();
// }

// export default function Profile() {
//   const [selectedPlan, setSelectedPlan] = useState<PlanKey | "">("");
//   const { isLoaded, isSignedIn, user } = useUser();
//   const queryClient = useQueryClient();
//   const router = useRouter();

//   const {
//     data: subscription,
//     isLoading,
//     isError,
//     error,
//   } = useQuery({
//     queryKey: ["subscription"], // unified key
//     queryFn: fetchSubscriptionStatus,
//     enabled: isLoaded && isSignedIn,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { mutate: updatePlanMutation, isPending: isUpdatePlanPending } = useMutation({
//     mutationFn: updatePlan,
//     onSuccess: async () => {
//       await queryClient.invalidateQueries({ queryKey: ["subscription"] });
//       toast.success("Subscription plan updated successfully");
//     },
//     onError: (e: unknown) => {
//       toast.error(e instanceof Error ? e.message : "Error updating plan");
//     },
//   });

//   const { mutate: unsubscribeMutation, isPending: isUnsubscribePending } = useMutation({
//     mutationFn: unsubscribe,
//     onSuccess: async () => {
//       await queryClient.invalidateQueries({ queryKey: ["subscription"] });
//       router.push("/subscribe");
//     },
//     onError: (e: unknown) => {
//       toast.error(e instanceof Error ? e.message : "Error unsubscribing.");
//     },
//   });

//   // Normalize DB/webhook tier (WEEKLY|MONTHLY|YEARLY) -> availablePlans.interval (week|month|year)
//   const tierRaw = (subscription?.subscription?.subscriptionTier ?? null) as SubTier;
//   const normalized: PlanKey | null =
//     tierRaw === "WEEKLY" ? "week" : tierRaw === "MONTHLY" ? "month" : tierRaw === "YEARLY" ? "year" : null;

//   const currentPlan = availablePlans.find((p) => p.interval === normalized);

//   function handleUpdatePlan() {
//     if (selectedPlan) {
//       updatePlanMutation(selectedPlan as PlanKey);
//       setSelectedPlan("");
//     }
//   }

//   function handleUnsubscribe() {
//     if (confirm("Are you sure you want to unsubscribe? You will lose premium features.")) {
//       unsubscribeMutation();
//     }
//   }

//   if (!isLoaded) {
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-emerald-100">
//         <Spinner /> <span className="ml-2">Loading...</span>
//       </div>
//     );
//   }

//   if (!isSignedIn) {
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-emerald-100">
//         <p>Please sign in to view your profile.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-emerald-100 p-4">
//       <Toaster position="top-center" />
//       <div className="w-full max-w-5xl bg-white shadow-lg rounded-lg overflow-hidden">
//         <div className="flex flex-col md:flex-row">
//           {/* Left column (profile card) */}
//           <div className="w-full md:w-1/3 p-6 bg-emerald-500 text-white flex flex-col items-center">
//             {user.imageUrl && (
//               <Image
//                 src={user.imageUrl}
//                 alt="User Avatar"
//                 width={100}
//                 height={100}
//                 className="rounded-full mb-4"
//               />
//             )}
//             <h1 className="text-2xl font-bold mb-2">
//               {user.firstName} {user.lastName}
//             </h1>
//             <p className="mb-4">{user.primaryEmailAddress?.emailAddress}</p>
//           </div>

//           {/* Right column (stack of cards) */}
//           <div className="w-full md:w-2/3 p-6 bg-gray-50">
//             <h2 className="text-2xl font-bold mb-6 text-emerald-700">Subscription Details</h2>

//             {isLoading ? (
//               <div className="flex items-center">
//                 <Spinner /> <span className="ml-2">Loading subscription details...</span>
//               </div>
//             ) : isError ? (
//               <p className="text-red-500">{(error as Error)?.message}</p>
//             ) : subscription ? (
//               <div className="space-y-6">
//                 {/* Current Plan card */}
//                 <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
//                   <h3 className="text-xl font-semibold mb-2 text-emerald-600">Current Plan</h3>
//                   {currentPlan ? (
//                     <>
//                       <p>
//                         <strong>Plan: </strong> {currentPlan.name}
//                       </p>
//                       <p>
//                         <strong>Amount: </strong>${currentPlan.amount} {currentPlan.currency}
//                       </p>
//                       <p>
//                         <strong>Status: </strong> Active
//                       </p>
//                     </>
//                   ) : (
//                     <p className="text-red-500">Current plan not found</p>
//                   )}
//                 </div>

//                 {/* Change Subscription Plan card */}
//                 <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
//                   <h3 className="text-xl font-semibold mb-2 text-emerald-600">Change Subscription Plan</h3>
//                   {currentPlan && (
//                     <>
//                       <select
//                         defaultValue={currentPlan.interval}
//                         disabled={isUpdatePlanPending}
//                         onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
//                           setSelectedPlan(e.target.value as PlanKey | "")
//                         }
//                         className="w-full px-3 py-2 border border-emerald-300 rounded-md text-black focus:outline-none"
//                       >
//                         <option value="">Select a New Plan</option>
//                         {availablePlans.map((plan) => (
//                           <option key={plan.interval} value={plan.interval}>
//                             {plan.name} - ${plan.amount} / {plan.interval}
//                           </option>
//                         ))}
//                       </select>

//                       <button
//                         onClick={handleUpdatePlan}
//                         disabled={isUpdatePlanPending || !selectedPlan}
//                         className="mt-3 p-2 bg-emerald-500 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
//                       >
//                         {isUpdatePlanPending ? "Updating..." : "Save Change"}
//                       </button>
//                     </>
//                   )}
//                 </div>

//                 {/* Unsubscribe card */}
//                 <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
//                   <h3 className="text-xl font-semibold mb-2 text-emerald-600">Unsubscribe</h3>
//                   <button
//                     onClick={handleUnsubscribe}
//                     disabled={isUnsubscribePending}
//                     className={`w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors ${
//                       isUnsubscribePending ? "opacity-50 cursor-not-allowed" : ""
//                     }`}
//                   >
//                     {isUnsubscribePending ? "Unsubscribing..." : "Unsubscribe"}
//                   </button>
//                 </div>
//               </div>
//             ) : (
//               <p className="text-red-500">You are not subscribed to any plan.</p>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
