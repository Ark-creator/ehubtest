import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { X, Plus, CalendarIcon, Building, DollarSign, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Project, User } from '../../types';

interface CreateProjectFormProps {
  currentUser: User;
  users: User[];
  onCreateProject: (project: any) => Promise<void>;
  onClose: () => void;
  onClientCreated?: (user: User) => void;
}

export function CreateProjectForm({ currentUser, users, onCreateProject, onClose }: CreateProjectFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium' as Project['priority'],
    clientId: '',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    supervisorId: '',
    fabricatorIds: [] as string[],
    
    // Financials
    totalProjectPrice: '', // Input: Revenue
    fabricatorAllocation: '', // Expense
    materialsAllocation: '', // Expense
    supervisorAllocation: '', // Expense
    companyAllocation: '', // Calculated: Profit/Margin
    
    supervisorAssignsFabricators: false,
    documentationUrl: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const supervisors = users.filter(u => u.role === 'supervisor');
  const fabricators = users.filter(u => u.role === 'fabricator');
  const clients = users.filter(u => u.role === 'client');

  // --- NEW LOGIC: Calculate Company Allocation (Excess) ---
  useEffect(() => {
    const total = parseFloat(formData.totalProjectPrice) || 0;
    const fab = parseFloat(formData.fabricatorAllocation) || 0;
    const mat = parseFloat(formData.materialsAllocation) || 0;
    const sup = parseFloat(formData.supervisorAllocation) || 0;

    // Company Allocation = Revenue - Expenses
    const remaining = total - (fab + mat + sup);
    
    setFormData(prev => ({ ...prev, companyAllocation: remaining.toFixed(2) }));
  }, [
    formData.totalProjectPrice,
    formData.fabricatorAllocation,
    formData.materialsAllocation,
    formData.supervisorAllocation
  ]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Project description is required';
    if (!formData.supervisorId) newErrors.supervisorId = 'Supervisor selection is required';
    
    if (!formData.supervisorAssignsFabricators && formData.fabricatorIds.length === 0) {
      newErrors.fabricatorIds = 'At least one fabricator must be assigned or supervisor must assign manually';
    }

    if (formData.endDate <= formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Check if Company Allocation is negative (Over Budget)
    if (parseFloat(formData.companyAllocation) < 0) {
      newErrors.financial = 'Allocations exceed the Total Project Price.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Also clear general financial error when typing in any financial field
    if (['totalProjectPrice', 'fabricatorAllocation', 'materialsAllocation', 'supervisorAllocation'].includes(field)) {
       setErrors(prev => ({ ...prev, financial: '' }));
    }
  };

  const handleAddFabricator = (fabricatorId: string) => {
    if (!formData.fabricatorIds.includes(fabricatorId)) {
      handleInputChange('fabricatorIds', [...formData.fabricatorIds, fabricatorId]);
    }
  };

  const handleRemoveFabricator = (fabricatorId: string) => {
    handleInputChange('fabricatorIds', formData.fabricatorIds.filter(id => id !== fabricatorId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      const totalProjectPrice = parseFloat(formData.totalProjectPrice) || 0;
      const shouldSupervisorAssign = formData.supervisorAssignsFabricators;
      const initialStatus: Project['status'] = shouldSupervisorAssign ? '0_Created' : '1_Assigned_to_FAB';

      const projectData = {
        name: formData.name,
        title: formData.name, 
        description: formData.description,
        clientId: formData.clientId || null,
        status: initialStatus,
        priority: formData.priority,
        startDate: format(formData.startDate, 'yyyy-MM-dd'),
        endDate: format(formData.endDate, 'yyyy-MM-dd'),
        progress: 0,
        supervisorId: formData.supervisorId,
        fabricatorIds: formData.supervisorAssignsFabricators ? [] : formData.fabricatorIds,
        documentationUrl: formData.documentationUrl || undefined,
        
        // --- FINANCIAL DATA ---
        // Revenue is the Total Price input by user
        revenue: totalProjectPrice, 
        totalProjectPrice: totalProjectPrice,
        
        // Budget is also the Total Price (the pool of money available)
        budget: totalProjectPrice, 
        
        // Spent is 0 (No actual work done yet)
        spent: 0,

        // Allocations (Breakdown of the Budget)
        fabricatorAllocation: parseFloat(formData.fabricatorAllocation) || 0,
        materialsAllocation: parseFloat(formData.materialsAllocation) || 0,
        supervisorAllocation: parseFloat(formData.supervisorAllocation) || 0,
        companyAllocation: parseFloat(formData.companyAllocation) || 0,
      };

      await onCreateProject(projectData);
      onClose();
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFabricatorName = (id: string) => {
    return users.find(u => u.id === id)?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Create New Project
            </CardTitle>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter project name"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select 
                    value={formData.clientId} 
                    onValueChange={(value) => handleInputChange('clientId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Client (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter project description"
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: Project['priority']) => handleInputChange('priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Timeline</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.startDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.startDate}
                        onSelect={(date) => {
                          if (date) {
                            handleInputChange('startDate', date);
                            setShowStartCalendar(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.endDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.endDate}
                        onSelect={(date) => {
                          if (date) {
                            handleInputChange('endDate', date);
                            setShowEndCalendar(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
                </div>
              </div>
            </div>

            {/* Team Assignment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Team Assignment</h3>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor *</Label>
                <Select
                  value={formData.supervisorId}
                  onValueChange={(value) => handleInputChange('supervisorId', value)}
                >
                  <SelectTrigger className={errors.supervisorId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map(supervisor => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supervisorId && <p className="text-sm text-destructive">{errors.supervisorId}</p>}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="supervisorAssignsFabricators"
                  type="checkbox"
                  checked={formData.supervisorAssignsFabricators}
                  onChange={(e) => handleInputChange('supervisorAssignsFabricators', e.target.checked)}
                  className="cursor-pointer"
                />
                <Label htmlFor="supervisorAssignsFabricators" className="cursor-pointer">
                  Supervisor will assign fabricators manually
                </Label>
              </div>

              {!formData.supervisorAssignsFabricators && (
                <div className="space-y-2">
                  <Label>Fabricators *</Label>
                  <Select onValueChange={handleAddFabricator}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add fabricators" />
                    </SelectTrigger>
                    <SelectContent>
                      {fabricators
                        .filter(fab => !formData.fabricatorIds.includes(fab.id))
                        .map(fabricator => (
                          <SelectItem key={fabricator.id} value={fabricator.id}>
                            {fabricator.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {formData.fabricatorIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.fabricatorIds.map(id => (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1">
                          {getFabricatorName(id)}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveFabricator(id)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  {errors.fabricatorIds && <p className="text-sm text-destructive">{errors.fabricatorIds}</p>}
                </div>
              )}
            </div>

            {/* Financial Allocation */}
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <h3 className="text-lg font-medium">Financial Allocation</h3>
                <div className="text-sm text-muted-foreground">Planning</div>
              </div>

              {/* Input for Total Price */}
              <div className="space-y-2">
                <Label htmlFor="totalProjectPrice" className="text-lg font-semibold text-primary">
                  Total Project Price (Revenue) ₱
                </Label>
                <Input
                  id="totalProjectPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.totalProjectPrice}
                  onChange={(e) => handleInputChange('totalProjectPrice', e.target.value)}
                  placeholder="e.g. 100000"
                  className="text-lg font-bold"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fabricatorAllocation">Fabricator Allocation (₱)</Label>
                  <Input
                    id="fabricatorAllocation"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fabricatorAllocation}
                    onChange={(e) => handleInputChange('fabricatorAllocation', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Labor costs for fabricators.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialsAllocation">Materials Allocation (₱)</Label>
                  <Input
                    id="materialsAllocation"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.materialsAllocation}
                    onChange={(e) => handleInputChange('materialsAllocation', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Expected material costs.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supervisorAllocation">Supervisor Allocation (₱)</Label>
                  <Input
                    id="supervisorAllocation"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.supervisorAllocation}
                    onChange={(e) => handleInputChange('supervisorAllocation', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Supervisor fees/overhead.</p>
                </div>
                
                {/* Calculated Company Allocation */}
                <div className="space-y-2">
                  <Label htmlFor="companyAllocation" className="flex items-center gap-2">
                    Company Allocation (Profit)
                    {parseFloat(formData.companyAllocation) < 0 && (
                      <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                    )}
                  </Label>
                  <Input
                    id="companyAllocation"
                    readOnly
                    value={formData.companyAllocation}
                    className={`font-medium ${parseFloat(formData.companyAllocation) < 0 ? 'border-destructive text-destructive' : 'bg-muted'}`}
                  />
                  <p className="text-xs text-muted-foreground">Auto-calculated (Total - Allocations).</p>
                </div>
              </div>
              
              {errors.financial && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {errors.financial}
                </div>
              )}
            </div>

            {/* Documentation */}
            <div className="space-y-4">
              <h3>Documentation (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="documentationUrl">Google Drive Documentation URL</Label>
                <Input
                  id="documentationUrl"
                  type="url"
                  value={formData.documentationUrl}
                  onChange={(e) => handleInputChange('documentationUrl', e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}