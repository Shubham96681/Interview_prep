import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Dialog components not currently used
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Video,
  Plus,
  Edit
} from 'lucide-react';
import { Session } from '@/lib/mockData';

interface InteractiveCalendarProps {
  expertId: string;
  sessions: Session[];
  availabilitySlots?: any[];
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  type: 'booking' | 'availability';
  status?: string;
  clientName?: string;
  sessionType?: string;
  color: string;
}

export default function InteractiveCalendar({ sessions, availabilitySlots = [] }: InteractiveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  // Generate calendar events from sessions and availability
  useEffect(() => {
    const generateEvents = (): CalendarEvent[] => {
      const calendarEvents: CalendarEvent[] = [];

      // Add sessions as booking events
      sessions.forEach(session => {
        // Handle date parsing - use local date components to avoid timezone shifts
        let sessionDate: Date;
        let dateStr: string;
        let timeStr: string;
        
        if (session.scheduledDate) {
          // If we have scheduledDate (ISO string), parse it and use local components
          sessionDate = new Date(session.scheduledDate);
          if (!isNaN(sessionDate.getTime())) {
            // Use local date components to avoid timezone shifts
            const year = sessionDate.getFullYear();
            const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
            const day = String(sessionDate.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
            timeStr = session.time || `${String(sessionDate.getHours()).padStart(2, '0')}:${String(sessionDate.getMinutes()).padStart(2, '0')}`;
          } else {
            return; // Skip invalid dates
          }
        } else if (session.date && session.time) {
          // If we have separate date and time strings, combine them as local time
          const [year, month, day] = session.date.split('-').map(Number);
          const [hours, minutes] = session.time.split(':').map(Number);
          sessionDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
          dateStr = session.date; // Use the date string directly
          timeStr = session.time;
        } else if (session.date) {
          // If only date string, parse as local date
          const [year, month, day] = session.date.split('-').map(Number);
          sessionDate = new Date(year, month - 1, day);
          dateStr = session.date;
          timeStr = session.time || '00:00';
        } else {
          return; // Skip sessions without date
        }
        
        if (!isNaN(sessionDate.getTime())) {
          calendarEvents.push({
            id: session.id,
            title: `${session.candidateName || 'Client'} - ${session.sessionType || 'Interview'}`,
            date: dateStr,
            time: timeStr,
            duration: session.duration || 60,
            type: 'booking',
            status: session.status,
            clientName: session.candidateName,
            sessionType: session.sessionType,
            color: session.status === 'completed' ? '#10B981' : 
                   session.status === 'scheduled' ? '#3B82F6' : '#F59E0B'
          });
        }
      });

      // Add availability slots
      availabilitySlots.forEach(slot => {
        if (slot.isActive) {
          calendarEvents.push({
            id: `availability-${slot.id}`,
            title: 'Available',
            date: slot.date,
            time: slot.startTime,
            duration: 480, // 8 hours default
            type: 'availability',
            color: '#E5E7EB'
          });
        }
      });

      return calendarEvents;
    };

    setEvents(generateEvents());
  }, [sessions, availabilitySlots]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    // Use local date components instead of ISO string to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return events.filter(event => event.date === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.type === 'availability') return 'bg-gray-200 text-gray-700';
    if (event.status === 'completed') return 'bg-green-100 text-green-800';
    if (event.status === 'scheduled') return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const days = getDaysInMonth(currentDate);
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Interactive Calendar</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('day')}
            >
              Day
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
            {formatDate(currentDate)}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) {
                return <div key={index} className="h-24"></div>;
              }

              const dayEvents = getEventsForDate(day);
              const isCurrentDay = isToday(day);
              const isSelectedDay = isSelected(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    h-24 p-1 border border-gray-200 cursor-pointer hover:bg-gray-50
                    ${isCurrentDay ? 'bg-blue-50 border-blue-300' : ''}
                    ${isSelectedDay ? 'bg-blue-100 border-blue-400' : ''}
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`
                      text-sm font-medium
                      ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}
                    `}>
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`
                          text-xs p-1 rounded truncate
                          ${getEventColor(event)}
                        `}
                        title={event.title}
                      >
                        {event.time} {event.type === 'booking' ? '📅' : '⏰'}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Events */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Events for {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: event.color }}></div>
                      <div>
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.time}
                          </span>
                          <span>{event.duration} min</span>
                          {event.type === 'booking' && (
                            <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                              {event.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.type === 'booking' ? (
                        <>
                          <Button size="sm" variant="outline">
                            <Video className="h-4 w-4 mr-1" />
                            Join
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Book Slot
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No events scheduled for this date</p>
                <Button className="mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Availability
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Completed Sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Scheduled Sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Pending Sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span>Available Slots</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






