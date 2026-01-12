import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  Package, 
  Plus, 
  Search,
  Filter,
  DollarSign,
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { Material, User, Project } from '../../types';

interface MaterialsManagerProps {
  currentUser: User;
  projects: Project[];
  materials: Material[];
  onAddMaterial: (material: Omit<Material, 'id' | 'addedAt'>) => void;
  onUpdateMaterial?: (id: string, material: Partial<Material>) => void;
  onDeleteMaterial?: (id: string) => void;
}

export function MaterialsManager({ 
  currentUser, 
  projects, 
  materials,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial
}: MaterialsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [statusFilter, setStatusFilter] = useState<Material['status'] | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: '',
    unit: '',
    cost: '',
    supplier: '',
    status: 'ordered' as Material['status'],
    projectId: '',
    category: ''
  });

  // Filter projects for current fabricator
  const fabricatorProjects = projects.filter(p => 
    p.fabricatorIds.includes(currentUser.id) && p.status !== 'pending-assignment'
  );

  // Filter materials
  const filteredMaterials = materials
    .filter(m => 
      (m.addedBy === currentUser.id || !m.projectId) &&
      (selectedProject === '' || selectedProject === 'all' || m.projectId === selectedProject || (selectedProject === 'general' && !m.projectId)) &&
      (statusFilter === 'all' || m.status === statusFilter) &&
      (searchTerm === '' || 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

  const materialCategories = [
    'Raw Materials',
    'Structural Materials',
    'Consumables',
    'Tools & Equipment',
    'Safety',
    'Electrical',
    'Finishing Materials',
    'Hardware',
    'Other'
  ];

  const units = [
    'pieces', 'kg', 'lbs', 'meters', 'feet', 'inches', 'liters', 'gallons',
    'sets', 'rolls', 'sheets', 'tubes', 'boxes', 'bags', 'cans'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newMaterial: Omit<Material, 'id' | 'addedAt'> = {
      name: formData.name,
      description: formData.description || undefined,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      cost: parseFloat(formData.cost),
      supplier: formData.supplier || undefined,
      status: formData.status,
      projectId: (formData.projectId && formData.projectId !== 'none') ? formData.projectId : undefined,
      addedBy: currentUser.id,
      category: formData.category || undefined
    };

    onAddMaterial(newMaterial);

    // Reset form
    setFormData({
      name: '',
      description: '',
      quantity: '',
      unit: '',
      cost: '',
      supplier: '',
      status: 'ordered',
      projectId: 'none',
      category: ''
    });
    setShowAddForm(false);
  };

  const getStatusIcon = (status: Material['status']) => {
    switch (status) {
      case 'ordered':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-use':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'depleted':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Material['status']) => {
    switch (status) {
      case 'ordered':
        return 'secondary';
      case 'delivered':
        return 'default';
      case 'in-use':
        return 'secondary';
      case 'depleted':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'General Inventory';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const getTotalValue = () => {
    return filteredMaterials.reduce((total, m) => total + (m.cost * m.quantity), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materials Management {materials.length}
          </h2>
          <p className="text-muted-foreground">Manage materials and inventory for your projects</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Total Items</span>
            </div>
            <p className="text-2xl">{filteredMaterials.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Total Value</span>
            </div>
            <p className="text-2xl">₱{getTotalValue().toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">In Use</span>
            </div>
            <p className="text-2xl">{materials.filter(m => m.status === 'in-use' && m.addedBy === currentUser.id).length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm">Depleted</span>
            </div>
            <p className="text-2xl">{materials.filter(m => m.status === 'depleted' && m.addedBy === currentUser.id).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search Materials</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Project Filter</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  <SelectItem value="general">General Inventory</SelectItem>
                  {fabricatorProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={(value: Material['status'] | 'all') => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="in-use">In Use</SelectItem>
                  <SelectItem value="depleted">Depleted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={() => {
                setSelectedProject('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Material Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Material</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Material Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter material name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional material description"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">Cost per Unit (₱) *</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) => handleInputChange('supplier', e.target.value)}
                    placeholder="Enter supplier name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value: Material['status']) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="in-use">In Use</SelectItem>
                      <SelectItem value="depleted">Depleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">Assign to Project</Label>
                <Select value={formData.projectId} onValueChange={(value) => handleInputChange('projectId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="General inventory (no project)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General Inventory</SelectItem>
                    {fabricatorProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materials Inventory
            <Badge variant="outline">{filteredMaterials.length} items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg mb-2">No materials found</h3>
              <p className="text-muted-foreground">
                Start adding materials to track your inventory.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(material.status)}
                      <div>
                        <h4 className="font-medium">{material.name}</h4>
                        {material.description && (
                          <p className="text-sm text-muted-foreground">{material.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(material.status)}>
                        {material.status}
                      </Badge>
                      {material.category && (
                        <Badge variant="outline">{material.category}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p>{material.quantity} {material.unit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unit Cost</p>
                      <p><span className="text-lg">₱{material.cost.toLocaleString()}</span></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Value</p>
                      <p>₱{(material.cost * material.quantity).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Project</p>
                      <p>{getProjectName(material.projectId)}</p>
                    </div>
                  </div>

                  {material.supplier && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Supplier: {material.supplier}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-2">
                    Added on {new Date(material.addedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}