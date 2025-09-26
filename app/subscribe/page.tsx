"use client";

import { availablePlans } from "@/lib/plans";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

type SubscribeResponse = { url: string };
type SubscribeError = { error?: string };

async function subscribeToPlan(params: {
  planType: string;
  userId: string;
  email: string;
}): Promise<SubscribeResponse> {
  const { planType, userId, email } = params;

  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      planType, 
      userId, 
      email 
    }),
  });

  if (!response.ok) {
    const err: SubscribeError = await response.json().catch(() => ({}));
    throw new Error(err.error ?? "Something went wrong.");
  }

  return (await response.json()) as SubscribeResponse;
}

export default function Subscribe() {
  const { user } = useUser();
  const router = useRouter();

  const userId = user?.id ?? "";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  const { mutate, isPending } = useMutation<
    SubscribeResponse,
    Error,
    { planType: string }
  >({
    mutationFn: async ({ planType }) => {
      if (!userId) throw new Error("User not signed in.");
      return subscribeToPlan({ planType, userId, email });
    },
    onMutate: () => {
      toast.loading("Processing your your subscription...");
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (_error) => {
      toast.error("Something went wrong");
    },
  });

  function handleSubscribe(planType: string) {
    if (!userId) {
      router.push("/sign-up");
      return;
    }
    mutate({ planType });
  }

  return (
    <>
      <Toaster position="top-right" />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-semibold">Pricing</h2>
          <p className="mt-2 text-gray-600">
            Get started on our weekly plan or upgrade to monthly or yearly when
            you are ready.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {availablePlans.map((plan) => {
            const popular = !!plan.isPopular;

            const cardClasses =
              "relative rounded-2xl border bg-white p-6 md:p-8 shadow-sm";
            const cardBorder = popular ? "border-emerald-300" : "border-gray-200";

            const buttonClasses = popular
              ? "mt-6 w-full rounded-md bg-emerald-600 text-white py-3 font-medium hover:bg-emerald-700 transition"
              : "mt-6 w-full rounded-md bg-emerald-100 text-emerald-800 py-3 font-medium hover:bg-emerald-200 transition";

            return (
              <div key={plan.name} className={`${cardClasses} ${cardBorder}`}>
                {/* Badge */}
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-medium">{plan.name}</h3>

                <p className="mt-2 text-4xl md:text-5xl font-bold">
                  ${plan.amount.toFixed(2)}{" "}
                  <span className="align-middle text-base font-normal text-gray-500">
                    /{plan.interval}
                  </span>
                </p>

                <p className="mt-3 text-gray-600">{plan.description}</p>

                <ul className="mt-5 space-y-3">
                  {plan.features.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-6 h-6 flex-shrink-0 text-emerald-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={buttonClasses}
                  onClick={() => handleSubscribe(String(plan.interval))}
                  disabled={isPending}
                >
                  {isPending ? "Please wait..." : `Subscribe ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
