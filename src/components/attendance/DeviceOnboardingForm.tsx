import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Device } from '@/types/attendance';
import { Loader2, Trash2 } from 'lucide-react';

export const DeviceOnboardingForm: React.FC = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceSecret, setDeviceSecret] = useState('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error('Error fetching devices:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceSerial.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Device serial is required',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Call RPC function
      const { data, error } = await supabase.rpc('register_device', {
        p_device_serial: deviceSerial.trim(),
        p_name: deviceName.trim() || null,
        p_secret: deviceSecret.trim() || null
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Device registered successfully'
      });

      // Reset form
      setDeviceSerial('');
      setDeviceName('');
      setDeviceSecret('');

      // Refresh list
      fetchDevices();
    } catch (error: any) {
      console.error('Error registering device:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Delete this device? This will remove all mappings and logs.')) return;

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Device deleted'
      });

      fetchDevices();
    } catch (error: any) {
      console.error('Error deleting device:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Register Attendance Device</CardTitle>
          <CardDescription>
            Add a new fingerprint/PIN attendance machine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegisterDevice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serial">Device Serial *</Label>
              <Input
                id="serial"
                placeholder="DEV001"
                value={deviceSerial}
                onChange={(e) => setDeviceSerial(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Device Name</Label>
              <Input
                id="name"
                placeholder="Main Entrance"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret">HMAC Secret (optional)</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Leave empty for no signature verification"
                value={deviceSecret}
                onChange={(e) => setDeviceSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If set, device must send X-Signature header with HMAC-SHA256
              </p>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Device
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No devices registered yet
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{device.device_serial}</p>
                    {device.name && (
                      <p className="text-sm text-muted-foreground">{device.name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          device.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {device.active ? 'Active' : 'Inactive'}
                      </span>
                      {device.secret && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          HMAC Enabled
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteDevice(device.id)}
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

