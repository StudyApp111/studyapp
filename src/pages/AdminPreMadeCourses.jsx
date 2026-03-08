import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Globe, Lock, Loader2, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminPreMadeCourses() {
    // Admin dashboard for managing pre-made courses
    const [user, setUser] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        base44.auth.me().then(u => {
            if (u?.role !== 'admin') window.location.href = '/';
            setUser(u);
        }).catch(() => window.location.href = '/');
    }, []);

    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['adminPreMadeCourses'],
        queryFn: () => base44.entities.PreMadeCourse.list('-created_date'),
        enabled: !!user
    });

    const { data: allLessons = [], isLoading: lessonsLoading } = useQuery({
        queryKey: ['adminAllLessons'],
        queryFn: () => base44.entities.Lesson.list('-created_date', 500),
        enabled: !!user
    });

    const createCourseMutation = useMutation({
        mutationFn: (data) => base44.entities.PreMadeCourse.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPreMadeCourses'] });
            setEditingCourse(null);
        }
    });

    const updateCourseMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.PreMadeCourse.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPreMadeCourses'] });
            setEditingCourse(null);
        }
    });

    const deleteCourseMutation = useMutation({
        mutationFn: (id) => base44.entities.PreMadeCourse.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminPreMadeCourses'] })
    });

    const generateContentMutation = useMutation({
        mutationFn: async (id) => {
            const res = await base44.functions.invoke('generatePreMadeCourseContent', { pre_made_course_id: id });
            if (res.data?.error) throw new Error(res.data.error);
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminPreMadeCourses'] })
    });

    if (!user) return null;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Manage Pre-Made Courses</h1>
                <Button onClick={() => setEditingCourse({ course_name: '', description: '', category: '', icon: '📚', is_published: false, education_level: 'university', institution: '' })}>
                    <Plus className="w-4 h-4 mr-2" /> New Course
                </Button>
            </div>

            <Tabs defaultValue="courses" className="w-full">
                <TabsList className="mb-8">
                    <TabsTrigger value="courses">Manage Courses</TabsTrigger>
                    <TabsTrigger value="cached">Cached Lessons</TabsTrigger>
                </TabsList>

                <TabsContent value="courses">
            {editingCourse && (
                <Card className="mb-8 border-purple-200">
                    <CardHeader>
                        <CardTitle>{editingCourse.id ? 'Edit Course' : 'New Course'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Course Name</label>
                                <Input value={editingCourse.course_name} onChange={e => setEditingCourse({...editingCourse, course_name: e.target.value})} placeholder="e.g. BIOL 201" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Category</label>
                                <Input value={editingCourse.category || ''} onChange={e => setEditingCourse({...editingCourse, category: e.target.value})} placeholder="e.g. Biology" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Icon (Emoji)</label>
                                <Input value={editingCourse.icon || ''} onChange={e => setEditingCourse({...editingCourse, icon: e.target.value})} placeholder="🧬" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Education Level</label>
                                <Select value={editingCourse.education_level || 'university'} onValueChange={v => setEditingCourse({...editingCourse, education_level: v})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="university">University / College</SelectItem>
                                        <SelectItem value="k12">K-12</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Institution / Geography</label>
                                <Input value={editingCourse.institution || ''} onChange={e => setEditingCourse({...editingCourse, institution: e.target.value})} placeholder="e.g. Harvard or New York" />
                            </div>
                            <div className="flex items-center gap-2 mt-6">
                                <Switch checked={editingCourse.is_published} onCheckedChange={c => setEditingCourse({...editingCourse, is_published: c})} />
                                <label className="text-sm font-medium">Published</label>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Description</label>
                            <Textarea value={editingCourse.description || ''} onChange={e => setEditingCourse({...editingCourse, description: e.target.value})} placeholder="Course description..." />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Source Material (Extracted Content)</label>
                            <Textarea className="h-32" value={editingCourse.extracted_content || ''} onChange={e => setEditingCourse({...editingCourse, extracted_content: e.target.value})} placeholder="Paste course syllabus, notes, or textbook chapters here..." />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setEditingCourse(null)}>Cancel</Button>
                            <Button onClick={() => editingCourse.id ? updateCourseMutation.mutate({ id: editingCourse.id, data: editingCourse }) : createCourseMutation.mutate(editingCourse)}>
                                Save Course
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map(course => (
                    <Card key={course.id}>
                        <CardContent className="p-5 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{course.icon || '📚'}</span>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight">{course.course_name}</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {course.education_level === 'k12' ? 'K-12' : 'University'} • {course.institution || 'No institution'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch 
                                        checked={course.is_published} 
                                        onCheckedChange={(c) => updateCourseMutation.mutate({ id: course.id, data: { ...course, is_published: c } })} 
                                    />
                                    {course.is_published ? <Globe className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 mb-4 flex-1">{course.description}</p>
                            
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                <div className="text-xs text-slate-500">
                                    {course.diagnostic_questions?.length ? (
                                        <span className="text-emerald-600 font-medium">✓ Ready (5 questions)</span>
                                    ) : (
                                        <span className="text-amber-600 font-medium">⚠️ Needs Generation</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => generateContentMutation.mutate(course.id)} disabled={generateContentMutation.isPending}>
                                        {generateContentMutation.isPending && generateContentMutation.variables === course.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingCourse(course)}>
                                        <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { if(window.confirm('Are you sure?')) deleteCourseMutation.mutate(course.id) }}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
                </TabsContent>

                <TabsContent value="cached">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cached Lessons</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {lessonsLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Course Name</th>
                                                <th className="px-4 py-3">School</th>
                                                <th className="px-4 py-3">Grade/Level</th>
                                                <th className="px-4 py-3">City/Geography</th>
                                                <th className="px-4 py-3">Created</th>
                                                <th className="px-4 py-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {allLessons.map(lesson => (
                                                <tr key={lesson.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium">{lesson.course_name}</td>
                                                    <td className="px-4 py-3">{lesson.curriculum_map?.school || '-'}</td>
                                                    <td className="px-4 py-3">{lesson.curriculum_map?.grade || '-'}</td>
                                                    <td className="px-4 py-3">{lesson.curriculum_map?.city || '-'}</td>
                                                    <td className="px-4 py-3">{new Date(lesson.created_date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingCourse({
                                                                    course_name: lesson.course_name,
                                                                    description: lesson.description || '',
                                                                    category: '',
                                                                    icon: '📚',
                                                                    is_published: false,
                                                                    education_level: (lesson.curriculum_map?.grade || '').toLowerCase().includes('high') ? 'k12' : 'university',
                                                                    institution: lesson.curriculum_map?.school || lesson.curriculum_map?.city || '',
                                                                    extracted_content: lesson.extracted_content || '',
                                                                    compressed_content: lesson.compressed_content || ''
                                                                });
                                                                window.scrollTo(0, 0);
                                                            }}
                                                        >
                                                            Create Course
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}