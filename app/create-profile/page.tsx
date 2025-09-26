"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function CreateProfile() {
  type ApiResponse = {
    message: string;
    error: string;
  };

  async function createProfileRequest() {
    const response = await fetch("/api/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return data as ApiResponse;
  }

  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const { mutate, isPending } = useMutation<ApiResponse, Error>({
    mutationFn: createProfileRequest,
    onSuccess: () => {
      router.push("/subscribe");
    },
  });

  useEffect(() => {
    if (isLoaded && isSignedIn && !isPending) {
      mutate();
    }
    // include all referenced values to satisfy react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, isPending, mutate]);

  return <div> Processing sign in...</div>;
}
