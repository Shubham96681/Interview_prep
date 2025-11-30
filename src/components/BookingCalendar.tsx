import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CreditCard, X, CheckCircle } from "lucide-react";
import { generateSlots, computeAvailable, normalize } from "@/utils/slots";
import { formatDate, normalizeDate } from "@/utils/dateUtils";
import PaymentModal from "./PaymentModal";
import realtimeService from "@/lib/realtimeService";
import { apiService } from "@/lib/apiService";

interface BookingCalendarProps {
  expertId: string;
  expertName: string;
  hourlyRate: number;
  onBookSession: (date: string, time: string) => void;
}

interface Slot {
  date: string;
  booked: string[];
  disabled: string[];
  available: string[];
  count: number;
  isAvailable: boolean;
}

export default function BookingCalendar({ expertId, expertName, hourlyRate, onBookSession }: BookingCalendarProps) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const allSlots = generateSlots();

  // ------------------------------
  // Fetch Availability
  // ------------------------------
  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = normalizeDate(today.toISOString());
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      const end = normalizeDate(endDate.toISOString());

      const response = await apiService.getExpertBookedSlots(expertId, start, end);
      let booked: any[] = [];

      if (response.success) {
        booked =
          response.data?.data?.bookedSlots ||
          response.data?.bookedSlots ||
          response.data ||
          [];
      }

      const grouped: Record<string, string[]> = {};

      booked.forEach((b) => {
        if (!b.date || !b.time || b.status === "cancelled") return;

        const date = normalizeDate(b.scheduledDate || b.date);
        const time = normalize(b.time);

        grouped[date] = grouped[date] || [];
        grouped[date].push(time);
      });

      const list: Slot[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = normalizeDate(d.toISOString());

        const bookedTimes = grouped[dateStr] || [];
        const disabled: string[] = [];

        if (i === 0) {
          const now = new Date();
          allSlots.forEach((t) => {
            const [h, m] = t.split(":").map(Number);
            if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
              disabled.push(t);
            }
          });
        }

        const { available, count } = computeAvailable(allSlots, bookedTimes, disabled);

        list.push({
          date: dateStr,
          booked: bookedTimes,
          disabled,
          available,
          count,
          isAvailable: count > 0,
        });
      }

      setSlots(list);
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleAvailabilityUpdate = () => load();
    const handleSessionCreated = () => load();

    realtimeService.on("availability_updated", handleAvailabilityUpdate);
    realtimeService.on("session_created", handleSessionCreated);

    return () => {
      realtimeService.off("availability_updated", handleAvailabilityUpdate);
      realtimeService.off("session_created", handleSessionCreated);
    };
  }, [expertId]);

  // ------------------------------
  // Booking Flow
  // ------------------------------
  const handlePaySuccess = async () => {
    await onBookSession(selectedDate, selectedTime);
    setShowPayment(false);
    setTimeout(load, 1000);
  };

  const getSlotStatus = (date: string, time: string): "booked" | "not_available" | "available" => {
    const slot = slots.find((s) => s.date === date);
    if (!slot) return "not_available";

    const normalizedTime = normalize(time);

    if (slot.booked.includes(normalizedTime)) return "booked";
    if (slot.disabled.includes(normalizedTime)) return "not_available";
    if (slot.available.includes(normalizedTime)) return "available";

    return "not_available";
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading availability...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedSlot = slots.find((s) => s.date === selectedDate);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          Book Session with {expertName}
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Select a date and time slot to book your session
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date & Time</h3>

        {/* Date Selection */}
        <div>
          <h4 className="font-medium mb-3 text-gray-700">Select Date</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {slots.map((slot) => (
              <Button
                key={slot.date}
                variant={selectedDate === slot.date ? "default" : "outline"}
                className={`h-auto p-3 text-left relative transition-all duration-200 ${
                  !slot.isAvailable
                    ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-400"
                    : "hover:bg-blue-50 hover:border-blue-300"
                }`}
                onClick={() => {
                  if (slot.isAvailable) {
                    setSelectedDate(slot.date);
                    setSelectedTime("");
                  }
                }}
                disabled={!slot.isAvailable}
              >
                <div>
                  <div className="font-medium">{formatDate(slot.date)}</div>
                  <div
                    className={`text-xs flex items-center gap-1 ${
                      slot.isAvailable ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {slot.isAvailable ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="font-medium">{slot.count} slots</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 text-red-500" />
                        <span className="font-medium">Fully booked</span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Availability Legend */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="font-medium">Availability Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 bg-blue-50 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 bg-gray-100 rounded opacity-40"></div>
            <span>Not Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 bg-red-50 rounded opacity-40"></div>
            <span>Booked</span>
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && selectedSlot && (
          <div>
            <h4 className="font-medium mb-3 text-gray-700">Select Time</h4>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {allSlots.map((time) => {
                const slotStatus = getSlotStatus(selectedDate, time);

                // Check if this is a past time slot for today
                const today = new Date();
                const todayStr = normalizeDate(today.toISOString());
                const isPastTime =
                  selectedDate === todayStr &&
                  (() => {
                    const [hours, minutes] = time.split(":").map(Number);
                    const slotDateTime = new Date(today);
                    slotDateTime.setHours(hours, minutes, 0, 0);
                    return slotDateTime < today;
                  })();

                // Determine final status (past times override other statuses)
                const finalStatus = isPastTime ? "not_available" : slotStatus;
                const isBooked = finalStatus === "booked";
                const isAvailable = finalStatus === "available";
                const isUnavailable = finalStatus === "not_available";

                // Slot class mapping
                const slotClasses = {
                  booked: "opacity-40 cursor-not-allowed border-gray-300 bg-red-50",
                  not_available: "opacity-40 cursor-not-allowed border-gray-300",
                  available: "border-blue-500 text-blue-600 hover:bg-blue-50",
                };

                return (
                  <button
                    key={time}
                    className={`
                      flex items-center gap-2 w-24 justify-center py-2 rounded-lg border transition-all duration-200 relative
                      ${slotClasses[finalStatus]}
                      ${selectedTime === time && isAvailable ? "bg-blue-100 border-blue-600" : ""}
                    `}
                    disabled={isBooked || isUnavailable}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedTime(time);
                      }
                    }}
                  >
                    <Clock className="h-4 w-4" />
                    <span>{time}</span>
                    {(isBooked || isUnavailable) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div
                          className={`w-full h-0.5 transform rotate-45 opacity-80 ${
                            isBooked ? "bg-red-500" : "bg-gray-400"
                          }`}
                        ></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedDate && selectedSlot && selectedSlot.available.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No available slots for this date</p>
        )}

        {/* Booking Button */}
        {selectedDate && selectedTime && (
          <div className="pt-4 border-t">
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6 text-lg"
              onClick={() => setShowPayment(true)}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Book Session & Pay ${hourlyRate}
            </Button>
          </div>
        )}

        {showPayment && (
          <PaymentModal
            isOpen={showPayment}
            onClose={() => setShowPayment(false)}
            onPaymentSuccess={() => handlePaySuccess()}
            sessionData={{
              expertName,
              date: selectedDate,
              time: selectedTime,
              duration: 60,
              amount: hourlyRate,
              sessionType: 'mock',
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
