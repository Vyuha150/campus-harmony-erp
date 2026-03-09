import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { moduleConfigs } from '@/data/adminMockData';
import { Settings, ChevronDown, ChevronUp, Power } from 'lucide-react';
import { useState } from 'react';

export default function AdminModuleManagement() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const enabledCount = moduleConfigs.filter(m => m.enabled).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Module Management</h1>
            <p className="text-muted-foreground">Enable/disable ERP modules and configure sub-module access</p>
          </div>
          <Badge variant="outline" className="text-sm">{enabledCount}/{moduleConfigs.length} Modules Active</Badge>
        </div>

        <div className="space-y-3">
          {moduleConfigs.map(m => (
            <Card key={m.id} className={!m.enabled ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  >
                    <div className={`rounded-lg p-2 ${m.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Settings className={`h-5 w-5 ${m.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{m.name}</h3>
                      <p className="text-sm text-muted-foreground">{m.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{m.subModules.length} sub-modules</p>
                      <p className="text-xs text-muted-foreground">{m.roles.length} roles</p>
                    </div>
                    <Switch checked={m.enabled} />
                    {expanded === m.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {expanded === m.id && (
                  <div className="mt-4 border-t pt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Accessible by Roles</p>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map(r => (
                          <Badge key={r} variant="outline" className="capitalize text-xs">{r.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Sub-Modules</p>
                      <div className="space-y-2">
                        {m.subModules.map(sm => (
                          <div key={sm.id} className="flex items-center justify-between rounded-md border p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{sm.name}</p>
                              <p className="text-xs text-muted-foreground">{sm.path}</p>
                            </div>
                            <Switch checked={sm.enabled} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Last updated: {m.lastUpdated.toLocaleDateString('en-IN')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
