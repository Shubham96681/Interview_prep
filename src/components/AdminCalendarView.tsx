import { Badge } from '@/components/ui/badge';

interface Session {
  id: string;
  expertId: string;
  candidateId: string;
  expertName: string;
  candidateName: string;
  date: string;
  time: string;
  scheduledDate: string;
  duration: number;
  sessionType: string;
  status: string;
  paymentAmount?: number;
  paymentStatus?: string;
  feedbackRating?: number;
  feedbackComment?: string;
  additionalParticipants?: string[];
  reviews?: any[];
}

interface AdminCalendarViewProps {
  sessions: Session[];
  currentDate: Date;
  view: 'month' | 'week';
  onSessionClick: (session: Session) => void;
}

export default function AdminCalendarView({ 
  sessions, 
  currentDate, 
  view, 
  onSessionClick 
}: AdminCalendarViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getSessionsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(s => s.date === dateStr);
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (view === 'week') {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDaysList = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDaysList.push(day);
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, idx) => (
            <div key={idx} className="text-center font-semibold text-sm text-gray-600">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDaysList.map((day) => {
            const daySessions = getSessionsForDate(day);
            return (
              <div
                key={day.toISOString()}
                className="min-h-24 border rounded-lg p-2 bg-gray-50"
              >
                <div className="text-xs font-semibold mb-1">
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {daySessions.slice(0, 3).map((session) => (
                    <div
                      key={session.id}
                      className="text-xs p-1 rounded bg-blue-100 cursor-pointer hover:bg-blue-200"
                      onClick={() => onSessionClick(session)}
                      title={`${session.candidateName} - ${session.sessionType}`}
                    >
                      <div className="truncate">{session.time}</div>
                      <div className="truncate font-semibold">{session.candidateName}</div>
                    </div>
                  ))}
                  {daySessions.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{daySessions.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center font-semibold text-sm text-gray-600 p-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const daySessions = getSessionsForDate(day);
          const isToday = day && day.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={index}
              className={`min-h-24 border rounded-lg p-2 ${
                day ? (isToday ? 'bg-blue-50 border-blue-300' : 'bg-white') : 'bg-gray-50'
              }`}
            >
              {day && (
                <>
                  <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {daySessions.slice(0, 2).map((session) => (
                      <div
                        key={session.id}
                        className="text-xs p-1 rounded bg-blue-100 cursor-pointer hover:bg-blue-200"
                        onClick={() => onSessionClick(session)}
                        title={`${session.candidateName} - ${session.sessionType} - ${session.time}`}
                      >
                        <div className="truncate">{session.time}</div>
                        <div className="truncate font-semibold">{session.candidateName}</div>
                        <Badge variant="outline" className="text-xs mt-0.5">
                          {session.sessionType}
                        </Badge>
                      </div>
                    ))}
                    {daySessions.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{daySessions.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

