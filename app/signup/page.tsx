"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCont } from "@/components/Context";
import { HOSTEL_GROUPS, isHostelId, type HostelId } from "@/lib/hostels";

type RoomOption = {
  roomNumber: string;
  capacities: Array<{ value: 1 | 2 | 3 | 4; availableSpaces: number }>;
};

type SignupStep = "account" | "hostel" | "payment";

export default function SignupPage() {
  const router = useRouter();
  const { setIsAuthenticated } = useCont();
  const [step, setStep] = useState<SignupStep>("account");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomLookupFailed, setRoomLookupFailed] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [hostelId, setHostelId] = useState<HostelId | "">("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomCapacity, setRoomCapacity] = useState<1 | 2 | 3 | 4 | "">("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    matricNumber: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!hostelId) {
      return;
    }

    let isCurrentRequest = true;
    fetch(`/api/hostel-rooms?hostelId=${encodeURIComponent(hostelId)}`)
      .then(async (response) => {
        const result: { error?: string; rooms?: RoomOption[] } = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load room availability.");
        }
        if (isCurrentRequest) {
          setRooms(result.rooms ?? []);
          setError("");
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrentRequest) {
          setRoomLookupFailed(true);
          setError(requestError instanceof Error ? requestError.message : "Unable to load room availability.");
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoadingRooms(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [hostelId]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createAccount(withAccommodation: boolean) {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          matricNumber: form.matricNumber,
          password: form.password,
          ...(withAccommodation
            ? {
                accommodation: { hostelId, roomNumber, capacity: roomCapacity },
                paymentCompleted: true,
              }
            : {}),
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to create your account. Please try again.");
        return;
      }

      setIsAuthenticated(true);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setStep("hostel");
  }

  function handleRoomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStep("payment");
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#294d7d] focus:ring-2 focus:ring-[#294d7d]/15";
  const selectedRoom = rooms.find((room) => room.roomNumber === roomNumber);

  return (
    <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#102c56] p-12 text-white lg:flex">
        <div className="flex items-center gap-4">
          <Image src="/pau-logo2.png" alt="PAU" width={48} height={48} className="h-12 w-12 object-contain" />
          <span className="text-sm font-semibold uppercase tracking-widest text-white">
            Hostel Management System
          </span>
        </div>
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
            Pan-Atlantic University
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Your campus services, all in one place.
          </h1>
          <p className="mt-4 leading-7 text-blue-100">
            Create your student account, choose an available room, and complete the demo payment.
          </p>
        </div>
        <span className="text-xs text-blue-200">© Ayomide Kareem</span>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/4 sm:p-9">
          <div className="mb-7 lg:hidden">
            <Image src="/pau-logo2.png" alt="PAU" width={44} height={44} className="h-11 w-11 object-contain" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">
            Student account · Step {step === "account" ? "1" : step === "hostel" ? "2" : "3"} of 3
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#102c56]">
            {step === "account" ? "Create your account" : step === "hostel" ? "Choose a hostel and room" : "Complete payment"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === "account"
              ? "Start with your username and student details."
              : step === "hostel"
                ? "Choose from the rooms currently available."
                : "Payment is simulated and always succeeds in this demo."}
          </p>

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {step === "account" && (
            <form onSubmit={handleAccountSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="username"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Choose a username"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="matricNumber" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Matric number
                </label>
                <input
                  id="matricNumber"
                  name="matricNumber"
                  type="text"
                  autoComplete="off"
                  required
                  minLength={3}
                  maxLength={40}
                  value={form.matricNumber}
                  onChange={(event) => updateField("matricNumber", event.target.value)}
                  placeholder="Your student ID"
                  className={inputClass}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={256}
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder="At least 8 characters"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={256}
                    value={form.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    placeholder="Enter it again"
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#102c56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#193d70]"
              >
                Continue to hostel selection
              </button>
            </form>
          )}

          {step === "hostel" && (
            <form onSubmit={handleRoomSubmit} className="mt-7 space-y-4">
              <p className="rounded-lg bg-[#f5f7fb] px-3.5 py-3 text-xs leading-5 text-slate-600">
                Room numbers and capacities shown here are demo inventory.
              </p>
              <div>
                <label htmlFor="hostel" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Hostel
                </label>
                <select
                  id="hostel"
                  required
                  value={hostelId}
                  onChange={(event) => {
                    const selectedHostel = event.target.value;
                    const nextHostelId = isHostelId(selectedHostel) ? selectedHostel : "";
                    setHostelId(nextHostelId);
                    setRooms([]);
                    setRoomNumber("");
                    setRoomCapacity("");
                    setRoomLookupFailed(false);
                    setIsLoadingRooms(Boolean(nextHostelId));
                  }}
                  className={inputClass}
                >
                  <option value="" disabled>Select a hostel</option>
                  {HOSTEL_GROUPS.map((group) => (
                    <optgroup key={group.gender} label={`${group.gender} hostels`}>
                      {group.hostels.map((hostel) => (
                        <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {hostelId && (
                <>
                  <div>
                    <label htmlFor="roomNumber" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Room
                    </label>
                    <select
                      id="roomNumber"
                      required
                      value={roomNumber}
                      onChange={(event) => {
                        setRoomNumber(event.target.value);
                        setRoomCapacity("");
                      }}
                      disabled={isLoadingRooms || rooms.every((room) => room.capacities.length === 0)}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        {isLoadingRooms ? "Loading available rooms..." : rooms.length ? "Select a room" : "No rooms available"}
                      </option>
                      {rooms.filter((room) => room.capacities.length > 0).map((room) => (
                        <option key={room.roomNumber} value={room.roomNumber}>
                          {room.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedRoom && (
                    <div>
                      <label htmlFor="roomCapacity" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Room type
                      </label>
                      <select
                        id="roomCapacity"
                        required
                        value={roomCapacity}
                        onChange={(event) => setRoomCapacity(event.target.value ? Number(event.target.value) as 1 | 2 | 3 | 4 : "")}
                        className={inputClass}
                      >
                        <option value="" disabled>Select occupancy</option>
                        {selectedRoom.capacities.map(({ value, availableSpaces }) => (
                          <option key={value} value={value}>
                            {value}-person room ({availableSpaces} {availableSpaces === 1 ? "space" : "spaces"} available)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {hostelId && !isLoadingRooms && !roomLookupFailed && rooms.every((room) => room.capacities.length === 0) && (
                <p className="rounded-lg bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900">
                  No rooms are currently available in this hostel. You can still create your account without a hostel assignment.
                </p>
              )}
              <button
                type="submit"
                disabled={!hostelId || !roomNumber || !roomCapacity || isLoadingRooms}
                className="w-full rounded-lg bg-[#102c56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#193d70] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to payment
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => createAccount(false)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#102c56] transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isSubmitting ? "Creating account..." : "Create account without a hostel assignment"}
              </button>
              <button type="button" onClick={() => setStep("account")} className="w-full py-1 text-sm text-slate-500 hover:text-[#102c56]">
                Back to account details
              </button>
            </form>
          )}

          {step === "payment" && (
            <div className="mt-7 space-y-5">
              <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4">
                <p className="text-sm font-semibold text-[#102c56]">Room selection</p>
                <p className="mt-2 text-sm text-slate-600">
                  {HOSTEL_GROUPS.flatMap((group) => group.hostels).find((hostel) => hostel.id === hostelId)?.name}
                  {" · Room "}{roomNumber}{" · "}{roomCapacity}-person room
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Demo payment only. No charge will be made; payment is simulated and always succeeds.
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => createAccount(true)}
                className="w-full rounded-lg bg-[#102c56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#193d70] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Processing..." : "Pay & create student account"}
              </button>
              {error && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => createAccount(false)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#102c56] transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Create account without a hostel assignment
                </button>
              )}
              <button type="button" onClick={() => setStep("hostel")} className="w-full py-1 text-sm text-slate-500 hover:text-[#102c56]">
                Back to room selection
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#102c56] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
