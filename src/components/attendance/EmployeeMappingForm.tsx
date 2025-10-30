import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Device, Employee, DeviceEmployeeMapping } from '@/types/attendance';
import { Loader2, Trash2 } from 'lucide-react';

export const EmployeeMappingForm: React.FC = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mappings, setMappings] = useState<DeviceEmployeeMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceEmployeeId, setDeviceEmployeeId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch devices
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .eq('active', true)
        .order('name');

      if (devicesError) throw devicesError;
      setDevices(devicesData || []);

      // Fetch employees (RLS auto-filters by tenant)
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, tenant_id, name, email, is_active')
        .eq('is_active', true)
        .order('name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Fetch mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('device_employee_mappings')
        .select(`
          *,
          devices(device_serial, name),
          employees(name)
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (mappingsError) throw mappingsError;
      setMappings(mappingsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDeviceId || !deviceEmployeeId.trim() || !selectedEmployeeId) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Call RPC function
      const { error } = await supabase.rpc('map_device_employee', {
        p_device_id: selectedDeviceId,
        p_device_employee_id: deviceEmployeeId.trim(),
        p_employee_id: selectedEmployeeId
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Employee mapping created'
      });

      // Reset form
      setSelectedDeviceId('');
      setDeviceEmployeeId('');
      setSelectedEmployeeId('');

      // Refresh mappings
      fetchData();
    } catch (error: any) {
      console.error('Error creating mapping:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMapping = async (mappingId: number) => {
    if (!confirm('Delete this mapping?')) return;

    try {
      const { error } = await supabase
        .from('device_employee_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Mapping deleted'
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Mapping Form */}
      <Card>
        <CardHeader>
          <CardTitle>Map Device PIN to Employee</CardTitle>
          <CardDescription>
            Link employee PIN/card ID from attendance machine to your employee records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateMapping} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device">Device *</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger id="device">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name || device.device_serial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">Device PIN/Card ID *</Label>
              <Input
                id="pin"
                placeholder="1234 or card number"
                value={deviceEmployeeId}
                onChange={(e) => setDeviceEmployeeId(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The PIN or card number used by employee on attendance machine
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} {employee.email && `(${employee.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Mapping
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Mappings List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No mappings created yet
            </p>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping: any) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      PIN: {mapping.device_employee_id} → {mapping.employees?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Device: {mapping.devices?.name || mapping.devices?.device_serial}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteMapping(mapping.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

