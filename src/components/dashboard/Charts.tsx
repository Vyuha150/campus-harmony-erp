import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const attendanceData = [
  { month: 'Jul', present: 92, absent: 8 },
  { month: 'Aug', present: 88, absent: 12 },
  { month: 'Sep', present: 85, absent: 15 },
  { month: 'Oct', present: 90, absent: 10 },
  { month: 'Nov', present: 87, absent: 13 },
  { month: 'Dec', present: 91, absent: 9 },
];

const enrollmentData = [
  { year: '2020', ug: 4200, pg: 1800, phd: 450 },
  { year: '2021', ug: 4500, pg: 2000, phd: 520 },
  { year: '2022', ug: 4800, pg: 2200, phd: 580 },
  { year: '2023', ug: 5200, pg: 2400, phd: 640 },
  { year: '2024', ug: 5500, pg: 2600, phd: 720 },
];

const placementData = [
  { name: 'Placed', value: 78, color: 'hsl(var(--success))' },
  { name: 'Higher Studies', value: 12, color: 'hsl(var(--info))' },
  { name: 'Entrepreneurship', value: 5, color: 'hsl(var(--warning))' },
  { name: 'Seeking', value: 5, color: 'hsl(var(--muted-foreground))' },
];

const researchData = [
  { month: 'Jan', publications: 12, patents: 2, projects: 5 },
  { month: 'Feb', publications: 15, patents: 1, projects: 7 },
  { month: 'Mar', publications: 18, patents: 3, projects: 6 },
  { month: 'Apr', publications: 14, patents: 2, projects: 8 },
  { month: 'May', publications: 22, patents: 4, projects: 9 },
  { month: 'Jun', publications: 20, patents: 2, projects: 7 },
];

export function AttendanceChart() {
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
