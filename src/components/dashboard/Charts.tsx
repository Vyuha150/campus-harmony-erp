import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/apiService';

export function AttendanceChart() {
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/charts/attendance')
      .then((data) => setAttendanceData(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={attendanceData}>
        <defs>
          <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="month" 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Area
          type="monotone"
          dataKey="present"
          stroke="hsl(var(--success))"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorPresent)"
          name="Attendance %"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EnrollmentChart() {
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/charts/enrollment')
      .then((data) => setEnrollmentData(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={enrollmentData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="year" 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Bar dataKey="ug" name="UG" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pg" name="PG" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="phd" name="PhD" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlacementChart() {
  const [placementData, setPlacementData] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/charts/placement')
      .then((data) => setPlacementData(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={placementData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={4}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}%`}
          labelLine={false}
        >
          {placementData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ResearchChart() {
  const [researchData, setResearchData] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/charts/research')
      .then((data) => setResearchData(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={researchData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="month" 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="publications" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
          name="Publications"
        />
        <Line 
          type="monotone" 
          dataKey="patents" 
          stroke="hsl(var(--warning))" 
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--warning))', strokeWidth: 2 }}
          name="Patents"
        />
        <Line 
          type="monotone" 
          dataKey="projects" 
          stroke="hsl(var(--success))" 
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
          name="Projects"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
