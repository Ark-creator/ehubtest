import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Archive, Calendar, DollarSign, Download, Eye, FileText, GraduationCap, User, Building } from 'lucide-react';
import { Project, User as UserType, Material, WorkLogEntry } from '../../types';

interface ProjectArchivesProps {
  projects: Project[];
  users: UserType[];
  materials: Material[];
  workLogs: WorkLogEntry[];
  currentUser: UserType;
}

export function ProjectArchives({ 
  projects, 
  users, 
  materials, 
  workLogs, 
  currentUser 
}: ProjectArchivesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Get completed projects only
  const completedProjects = projects.filter(project => project.status === 'completed');

  // Get unique schools from completed projects
  const schools = Array.from(new Set(
    completedProjects.map(project => 
      users.find(u => u.role === 'client' && u.clientProjectId === project.id)?.school || 
      project.clientName
    )
  )).sort();

  // Filter projects based on search and school
  const filteredProjects = completedProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const projectSchool = users.find(u => u.role === 'client' && u.clientProjectId === project.id)?.school || 
                         project.clientName;
    const matchesSchool = selectedSchool === 'all' || projectSchool === selectedSchool;
    
    return matchesSearch && matchesSchool;
  });

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setShowDetailsDialog(true);
  };

  const getProjectMaterials = (projectId: string) => {
    return materials.filter(material => material.projectId === projectId);
  };

  const getProjectWorkLogs = (projectId: string) => {
    return workLogs.filter(log => log.projectId === projectId);
  };

  const calculateTotalMaterialCost = (projectId: string) => {
    return getProjectMaterials(projectId).reduce((total, material) => total + material.cost, 0);
  };

  const getFabricatorDocumentation = (project: Project) => {
    return project.attachments?.filter(att => 
      project.fabricatorIds.some(fabId => att.uploadedBy === fabId)
    ) || [];
  };

  const getCostAnalysisDocuments = (project: Project) => {
    return project.attachments?.filter(att => 
      att.name.toLowerCase().includes('cost') || 
      att.name.toLowerCase().includes('analysis') ||
      att.name.toLowerCase().includes('budget') ||
      att.type.includes('spreadsheet')
    ) || [];
  };

  const canViewFinancials = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="flex items-center gap-2">
            <Archive className="h-6 w-6" />
            Project Archives
          </h2>
          <p className="text-sm text-muted-foreground">
            Completed projects with documentation and cost analysis
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filteredProjects.length} Archived Projects
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Archives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Projects</Label>
              <Input
                id="search"
                placeholder="Search by name, description, or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school">Filter by School/Client</Label>
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select school/client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools/Clients</SelectItem>
                  {schools.map(school => (
                    <SelectItem key={school || 'no School'} value={school || 'no School'}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Grid */}
      <div className="grid gap-6">
        {filteredProjects.map((project) => {
          const supervisor = users.find(u => u.id === project.supervisorId);
          const fabricators = users.filter(u => project.fabricatorIds.includes(u.id));
          const client = users.find(u => u.role === 'client' && u.clientProjectId === project.id);
          const projectSchool = client?.school || project.clientName;
          const fabricatorDocs = getFabricatorDocumentation(project);
          const costDocs = getCostAnalysisDocuments(project);
          const materialCost = calculateTotalMaterialCost(project.id);

          return (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.description}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant="default" className="bg-green-600">
                      Completed
                    </Badge>
                    <Badge variant="outline">
                      {project.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {/* Project Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{projectSchool}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Supervisor: {supervisor?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{fabricators.length} Fabricators</span>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  {canViewFinancials && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Budget</p>
                        <p className="font-medium">${project.budget.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Spent</p>
                        <p className="font-medium">${project.spent.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Materials</p>
                        <p className="font-medium">${materialCost.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-medium text-green-600">${project.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Documentation Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">
                        {fabricatorDocs.length} Fabricator Documents
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        {costDocs.length} Cost Analysis Files
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">
                        {project.attachments?.length || 0} Total Documents
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(project)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {project.documentationUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(project.documentationUrl, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Documentation
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProjects.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg mb-2">No Archived Projects Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedSchool !== 'all' 
                  ? 'Try adjusting your search filters.'
                  : 'No completed projects available in the archives yet.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
            <DialogDescription>
              Completed project details and documentation
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="documentation">Documentation</TabsTrigger>
                  <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Project Description</Label>
                      <p className="text-sm mt-1">{selectedProject.description}</p>
                    </div>
                    <div>
                      <Label>Client/School</Label>
                      <p className="text-sm mt-1">
                        {users.find(u => u.role === 'client' && u.clientProjectId === selectedProject.id)?.school || 
                         selectedProject.clientName}
                      </p>
                    </div>
                    <div>
                      <Label>Project Duration</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedProject.startDate).toLocaleDateString()} - {new Date(selectedProject.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Completion Date</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedProject.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {canViewFinancials && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <Label>Total Budget</Label>
                        <p className="text-lg">${selectedProject.budget.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Amount Spent</Label>
                        <p className="text-lg">${selectedProject.spent.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Material Costs</Label>
                        <p className="text-lg">${calculateTotalMaterialCost(selectedProject.id).toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Total Revenue</Label>
                        <p className="text-lg text-green-600">${selectedProject.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documentation" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-3">Fabricator Documentation</h4>
                      <div className="grid gap-2">
                        {getFabricatorDocumentation(selectedProject).map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4" />
                              <div>
                                <p className="text-sm">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded by {users.find(u => u.id === doc.uploadedBy)?.name} on {new Date(doc.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3">All Project Documents</h4>
                      <div className="grid gap-2">
                        {selectedProject.attachments?.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4" />
                              <div>
                                <p className="text-sm">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(doc.size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        )) || <p className="text-sm text-muted-foreground">No documents available.</p>}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="costs" className="space-y-4">
                  {canViewFinancials ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-3">Cost Analysis Documents</h4>
                        <div className="grid gap-2">
                          {getCostAnalysisDocuments(selectedProject).map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <div>
                                  <p className="text-sm">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Created by {users.find(u => u.id === doc.uploadedBy)?.name}
                                  </p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3">Budget Breakdown by Fabricator</h4>
                        <div className="space-y-3">
                          {selectedProject.fabricatorBudgets?.map(budget => {
                            const fabricator = users.find(u => u.id === budget.fabricatorId);
                            const utilizationRate = (budget.spentAmount / budget.allocatedAmount) * 100;
                            
                            return (
                              <div key={budget.fabricatorId} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-medium">{fabricator?.name}</p>
                                    <p className="text-sm text-muted-foreground">{budget.description}</p>
                                  </div>
                                  <Badge variant={utilizationRate > 100 ? 'destructive' : 'default'}>
                                    {utilizationRate.toFixed(1)}% utilized
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Allocated:</span>
                                    <span className="ml-2">${budget.allocatedAmount.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Spent:</span>
                                    <span className="ml-2">${budget.spentAmount.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3">Material Costs</h4>
                        <div className="grid gap-2">
                          {getProjectMaterials(selectedProject.id).map(material => (
                            <div key={material.id} className="flex justify-between items-center p-3 border rounded-lg">
                              <div>
                                <p className="text-sm">{material.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {material.quantity} {material.unit} • {material.supplier}
                                </p>
                              </div>
                              <p className="font-medium">${material.cost.toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg mb-2">Financial Information Restricted</h3>
                      <p className="text-muted-foreground">
                        Cost analysis and budget information is only available to administrators.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="team" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-3">Project Supervisor</h4>
                      <div className="p-4 border rounded-lg">
                        {(() => {
                          const supervisor = users.find(u => u.id === selectedProject.supervisorId);
                          return supervisor ? (
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{supervisor.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {supervisor.school} • {supervisor.secureId}
                                </p>
                              </div>
                            </div>
                          ) : <p className="text-sm text-muted-foreground">Supervisor information not available</p>;
                        })()}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3">Fabricators</h4>
                      <div className="grid gap-3">
                        {selectedProject.fabricatorIds.map(fabricatorId => {
                          const fabricator = users.find(u => u.id === fabricatorId);
                          const workLogs = getProjectWorkLogs(selectedProject.id).filter(log => log.fabricatorId === fabricatorId);
                          const totalHours = workLogs.reduce((sum, log) => sum + log.hoursWorked, 0);
                          
                          return fabricator ? (
                            <div key={fabricatorId} className="p-4 border rounded-lg">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                                  <User className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{fabricator.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {fabricator.school} • {fabricator.secureId}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{totalHours} hours</p>
                                  <p className="text-xs text-muted-foreground">{workLogs.length} work logs</p>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}