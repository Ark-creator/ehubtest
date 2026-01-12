import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Calendar, DollarSign, Users, Building, FileText, Link, Paperclip, Plus, UserPlus, CheckCircle, Clock, XCircle, MessageSquare } from 'lucide-react';
import { Project, User } from '../../types';
import { CreateProjectForm } from './CreateProjectForm';
import { ProjectDetails } from './ProjectDetails';
import { emailService } from '../../utils/emailService';
import { ClientCreationDialog } from '../client/ClientCreationDialog';

interface ProjectsGridProps {
  projects: Project[];
  users: User[];
  currentUser: User;
  onCreateProject?: (project: Omit<Project, 'id'>) => void | Promise<void> | Promise<Project>;
  onAssignFabricator?: (projectId: string, fabricatorId: string, message?: string) => void;
  onUpdateProject?: (project: Project) => void;
  onAcceptAssignment?: (assignmentId: string, response?: string) => void;
  onDeclineAssignment?: (assignmentId: string, response?: string) => void;
  onCreateUser?: (user: User) => void;
}

export function ProjectsGrid({ projects, users, currentUser, onCreateProject, onAssignFabricator, onUpdateProject, onAcceptAssignment, onDeclineAssignment, onCreateUser }: ProjectsGridProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFabricatorId, setSelectedFabricatorId] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [clientDialogProject, setClientDialogProject] = useState<Project | null>(null);
  // Track locally assigned clients to avoid relying solely on parent refresh
  const [localClientAssignedProjectIds, setLocalClientAssignedProjectIds] = useState<Set<string>>(new Set());
  // For fabricator assignment responses
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [assignmentResponse, setAssignmentResponse] = useState('');

  const getFilteredProjects = () => {
    // First filter by role-based access
    let roleFilteredProjects;
    if (currentUser.role === 'admin') {
      roleFilteredProjects = projects;
    } else if (currentUser.role === 'supervisor') {
      roleFilteredProjects = projects.filter(p => p.supervisorId === currentUser.id);
    } else if (currentUser.role === 'fabricator') {
      // For fabricators, show both assigned projects and pending assignments
      roleFilteredProjects = projects.filter(p => 
        p.fabricatorIds.includes(currentUser.id) ||
        p.pendingAssignments?.some(assignment => 
          assignment.fabricatorId === currentUser.id && assignment.status === 'pending'
        )
      );
    } else {
      roleFilteredProjects = projects.filter(p => p.fabricatorIds.includes(currentUser.id));
    }

    // Then filter out completed projects (they should only appear in archives)
    return roleFilteredProjects.filter(p => p.status !== 'completed');
  };

  const filteredProjects = getFilteredProjects();
  // Determine if a client is already assigned to a project
  const isClientAssigned = (project: Project) => {
    if (localClientAssignedProjectIds.has(project.id)) return true;
    if (project.clientName && project.clientName.trim().length > 0) return true;
    // Fallback: check if there is a client user linked to this project
    return users.some(u => u.role === 'client' && u.clientProjectId === project.id);
  };

  // Get available fabricators for assignment (exclude already assigned ones)
  const getAvailableFabricators = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];

    return users.filter(u =>
      u.role === 'fabricator' &&
      !project.fabricatorIds.includes(u.id) &&
      !project.pendingAssignments?.some(pa => pa.fabricatorId === u.id && pa.status === 'pending')
    );
  };

  const handleAssignFabricator = () => {
    if (onAssignFabricator && selectedProjectId && selectedFabricatorId) {
      onAssignFabricator(selectedProjectId, selectedFabricatorId, assignMessage || undefined);
      setShowAssignForm(false);
      setSelectedProjectId('');
      setSelectedFabricatorId('');
      setAssignMessage('');
    }
  };

  const canCreateProject = (currentUser.role === 'admin' || currentUser.role === 'supervisor');

  const getStatusColor = (status: string) => {
    switch (status) {
      case '0_Created':
        return 'outline';
      case '1_Assigned_to_FAB':
        return 'secondary';
      case '2_Ready_for_Supervisor_Review':
        return 'destructive';
      case '3_Ready_for_Admin_Review':
        return 'destructive';
      case '4_Ready_for_Client_Signoff':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSupervisorName = (supervisorId: string) => {
    const supervisor = users.find(u => u.id === supervisorId);
    return supervisor?.name || 'Unknown Supervisor';
  };

  const getFabricatorNames = (fabricatorIds: string[]) => {
    return fabricatorIds
      .map(id => users.find(u => u.id === id)?.name || 'Unknown')
      .join(', ');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFabricatorBudget = (project: Project, fabricatorId: string) => {
    return project.fabricatorBudgets?.find(fb => fb.fabricatorId === fabricatorId);
  };

  const handleCreateProject = async (project: Omit<Project, 'id'>) => {
    let result;
    if (onCreateProject) {
      result = await onCreateProject(project);
    }
    return result;
  };

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    if (onUpdateProject) {
      onUpdateProject(updatedProject);
      // Send email notification about project update
      emailService.sendProjectUpdate(updatedProject, users, 'progress_update', currentUser);
    }
  };

  const handleMarkProjectAsDone = (project: Project) => {
    if (onUpdateProject) {
      const updatedProject = {
        ...project,
        status: '4_Ready_for_Client_Signoff' as Project['status'],
        progress: 100
      };
      onUpdateProject(updatedProject);
      // Send email notification about project completion
      emailService.sendProjectUpdate(updatedProject, users, 'status_change', currentUser);
    }
  };

  // Archive all projects that are ready to be archived (completed/finalized)
  const getArchivableProjects = () => {
    return projects.filter(p =>
      p.status === 'completed' ||
      p.status === '4_Ready_for_Client_Signoff' ||
      p.progress >= 100
    );
  };

  const handleArchiveAllCompleted = () => {
    if (!onUpdateProject) return;
    const archivable = getArchivableProjects();
    archivable.forEach(p => {
      const updated: Project = { ...p, status: 'completed' };
      onUpdateProject(updated);
    });
  };

  const handleTransition = (project: Project, nextStatus: Project['status']) => {
    if (!onUpdateProject) return;
    const updatedProject = { ...project, status: nextStatus };
    onUpdateProject(updatedProject);
    emailService.sendProjectUpdate(updatedProject, users, 'status_change', currentUser);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl">Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your projects</p>
        </div>
        <div className="flex gap-2">
          {(currentUser.role === 'admin' || currentUser.role === 'supervisor') && (
            <Button
              variant="outline"
              onClick={handleArchiveAllCompleted}
              disabled={getArchivableProjects().length === 0}
              title={getArchivableProjects().length === 0 ? 'No projects ready to archive' : ''}
            >
              Archive Completed ({getArchivableProjects().length})
            </Button>
          )}
          {canCreateProject && (
            <Button onClick={() => setShowCreateForm(true)} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-all duration-200 border-0 shadow-md overflow-hidden group">
            <div className="h-2 bg-gradient-to-r from-primary to-accent"></div>
            <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={getStatusColor(project.status)} className="text-xs">
                    {project.status}
                  </Badge>
                  <Badge variant={getPriorityColor(project.priority)} className="text-xs">
                    {project.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3" />
                  <span className="truncate">
                    Client: {project.clientName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(project.startDate).toLocaleDateString()} - {' '}
                    {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Role-based financial information */}
                {currentUser.role === 'fabricator' && (
                  <div className="space-y-1">
                    {(() => {
                      const fabricatorBudget = getFabricatorBudget(project, currentUser.id);
                      if (fabricatorBudget) {
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3 w-3" />
                              <span>My Budget: ₱{fabricatorBudget.allocatedAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3 w-3" />
                              <span>Spent: ₱{fabricatorBudget.spentAmount.toLocaleString()}</span>
                            </div>
                            <div className="text-xs text-muted-foreground ml-5">
                              {fabricatorBudget.description}
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3 w-3" />
                            <span>Project Value: ₱{project.revenue.toLocaleString()}</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}

                {currentUser.role === 'supervisor' && (
                  <>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span>
                        Budget: ₱{project.budget.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span>
                        Spent: ₱{project.spent.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                {currentUser.role === 'admin' && (
                  <>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span>
                        Revenue: ₱{project.revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span>
                        Budget: ₱{project.budget.toLocaleString()} | Spent: ₱{project.spent.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span className="truncate">
                    Supervisor: {getSupervisorName(project.supervisorId)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span className="truncate">
                    Team: {getFabricatorNames(project.fabricatorIds)}
                  </span>
                </div>

                {/* Documentation Link */}
                {project.documentationUrl && (
                  <div className="flex items-center gap-2">
                    <Link className="h-3 w-3" />
                    <a
                      href={project.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      Google Drive Documentation
                    </a>
                  </div>
                )}

                {/* File Attachments */}
                {project.attachments && project.attachments.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3" />
                      <span>Attachments ({project.attachments.length})</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      {project.attachments.slice(0, 2).map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-1 text-xs">
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{attachment.name}</span>
                          <span className="text-muted-foreground">
                            ({formatFileSize(attachment.size)})
                          </span>
                        </div>
                      ))}
                      {project.attachments.length > 2 && (
                        <div className="text-xs text-muted-foreground ml-4">
                          +{project.attachments.length - 2} more files
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Created by information */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span className="text-xs">
                    Created by: {users.find(u => u.id === project.createdBy)?.name || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Pending Assignment Banner for Fabricators */}
              {currentUser.role === 'fabricator' && project.pendingAssignments?.some(
                assignment => assignment.fabricatorId === currentUser.id && assignment.status === 'pending'
              ) && !project.fabricatorIds.includes(currentUser.id) && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-4 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-semibold text-orange-900 dark:text-orange-100">
                      New Project Assignment
                    </span>
                  </div>
                  {project.pendingAssignments
                    .filter(a => a.fabricatorId === currentUser.id && a.status === 'pending')
                    .map(assignment => {
                      const supervisor = users.find(u => u.id === assignment.assignedBy);
                      const isAcceptMode = selectedAssignment === `accept-${assignment.id}`;
                      const isDeclineMode = selectedAssignment === assignment.id && !selectedAssignment?.includes('accept-');
                      
                      return (
                        <div key={assignment.id} className="space-y-3">
                          {assignment.message && (
                            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-orange-200 dark:border-orange-800">
                              <div className="flex items-start gap-2 text-sm">
                                <MessageSquare className="h-4 w-4 mt-0.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                                    Message from Supervisor:
                                  </p>
                                  <p className="text-orange-800 dark:text-orange-200">{assignment.message}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span>Assigned by: <strong>{supervisor?.name || 'Unknown Supervisor'}</strong></span>
                          </div>
                          
                          {/* Action Buttons - Show when no mode is selected */}
                          {!isAcceptMode && !isDeclineMode && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => {
                                  setSelectedAssignment(`accept-${assignment.id}`);
                                  setAssignmentResponse('');
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Accept Assignment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400"
                                onClick={() => {
                                  setSelectedAssignment(assignment.id);
                                  setAssignmentResponse('');
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Decline Assignment
                              </Button>
                            </div>
                          )}

                          {/* Accept with Response */}
                          {isAcceptMode && (
                            <div className="space-y-3 bg-green-50 dark:bg-green-900/10 rounded-md p-3 border border-green-200 dark:border-green-800">
                              <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                Accept Assignment
                              </Label>
                              <Textarea
                                value={assignmentResponse}
                                onChange={(e) => setAssignmentResponse(e.target.value)}
                                placeholder="Add an optional message to the supervisor..."
                                className="text-sm"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setSelectedAssignment(null);
                                    setAssignmentResponse('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => {
                                    if (onAcceptAssignment) {
                                      onAcceptAssignment(assignment.id, assignmentResponse.trim() || undefined);
                                      setSelectedAssignment(null);
                                      setAssignmentResponse('');
                                    }
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Confirm Accept
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Decline with Response */}
                          {isDeclineMode && (
                            <div className="space-y-3 bg-red-50 dark:bg-red-900/10 rounded-md p-3 border border-red-200 dark:border-red-800">
                              <Label className="text-sm font-medium text-red-900 dark:text-red-100">
                                Decline Assignment
                              </Label>
                              <Textarea
                                value={assignmentResponse}
                                onChange={(e) => setAssignmentResponse(e.target.value)}
                                placeholder="Add an optional reason for declining..."
                                className="text-sm"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setSelectedAssignment(null);
                                    setAssignmentResponse('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() => {
                                    if (onDeclineAssignment) {
                                      onDeclineAssignment(assignment.id, assignmentResponse.trim() || undefined);
                                      setSelectedAssignment(null);
                                      setAssignmentResponse('');
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Confirm Decline
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewDetails(project)}
                >
                  View Details
                </Button>
                {(currentUser.role === 'admin' || currentUser.role === 'supervisor') && (
                  isClientAssigned(project) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Client already assigned to this project"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Client Assigned
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setClientDialogProject(project);
                        setShowClientDialog(true);
                      }}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Create Client
                    </Button>
                  )
                )}
                {/* {(currentUser.role === 'admin' ||
                  (currentUser.role === 'supervisor' && project.supervisorId === currentUser.id) ||
                  (currentUser.role === 'fabricator' && project.createdBy === currentUser.id)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(project)}
                    >
                      Edit
                    </Button>
                  )} */}
                {currentUser.role === 'supervisor' && project.supervisorId === currentUser.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowAssignForm(true);
                    }}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Assign
                  </Button>
                )}
                {/* Workflow Actions */}
                {currentUser.role === 'admin' && project.status === '0_Created' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleTransition(project, '1_Assigned_to_FAB')}
                  >
                    Assign Project
                  </Button>
                )}

                {currentUser.role === 'fabricator' && project.status === '1_Assigned_to_FAB' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleTransition(project, '2_Ready_for_Supervisor_Review')}
                    disabled={!(project.documentationUrl || (project.attachments && project.attachments.length > 0))}
                    title={!(project.documentationUrl || (project.attachments && project.attachments.length > 0)) ? 'Add documentation or files first' : ''}
                  >
                    Submit Work for Review
                  </Button>
                )}

                {currentUser.role === 'supervisor' && project.status === '2_Ready_for_Supervisor_Review' && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleTransition(project, '3_Ready_for_Admin_Review')}
                    >
                      Approve Work
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransition(project, '1_Assigned_to_FAB')}
                    >
                      Reject Work
                    </Button>
                  </>
                )}

                {currentUser.role === 'admin' && project.status === '3_Ready_for_Admin_Review' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleTransition(project, '4_Ready_for_Client_Signoff')}
                  >
                    Approve Final
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-lg mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {currentUser.role === 'admin'
                  ? 'Create your first project to get started.'
                  : currentUser.role === 'supervisor'
                    ? 'Create your first project to get started.'
                    : 'Wait for project assignments from your supervisor.'
                }
              </p>
              {canCreateProject && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <CreateProjectForm
          currentUser={currentUser}
          users={users}
          onCreateProject={async (project) => {
            await handleCreateProject(project);
          }}
          onClientCreated={onCreateUser || (() => { })}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {showAssignForm && (
        <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Fabricator to Project</DialogTitle>
              <DialogDescription>
                Select a fabricator to assign to this project and send them a message.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fabricatorId">Select Fabricator</Label>
                <Select value={selectedFabricatorId} onValueChange={setSelectedFabricatorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a fabricator" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableFabricators(selectedProjectId).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.secureId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignMessage">Message (optional)</Label>
                <Textarea
                  id="assignMessage"
                  value={assignMessage}
                  onChange={(e) => setAssignMessage(e.target.value)}
                  placeholder="Add a message for the fabricator about this project assignment..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowAssignForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignFabricator}
                  disabled={!selectedFabricatorId}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Assignment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showProjectDetails && selectedProject && (
        <ProjectDetails
          project={selectedProject}
          users={users}
          currentUser={currentUser}
          onUpdateProject={handleUpdateProject}
          onClose={() => setShowProjectDetails(false)}
        />
      )}

      {showClientDialog && clientDialogProject && (
        <ClientCreationDialog
          open={showClientDialog}
          onClose={() => {
            setShowClientDialog(false);
            setClientDialogProject(null);
          }}
          project={clientDialogProject}
          onClientCreated={(client) => {
            onCreateUser?.(client);
            // Immediately reflect client assignment in UI without waiting for parent refresh
            setLocalClientAssignedProjectIds(prev => new Set(prev).add(clientDialogProject.id));
            setShowClientDialog(false);
            setClientDialogProject(null);
          }}
        />
      )}
    </div>
  );
}