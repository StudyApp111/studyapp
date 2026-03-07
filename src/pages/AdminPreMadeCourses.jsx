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
                <Button onClick={() => setEditingCourse({ course_name: '', description: '', category: '', icon: '📚', is_published: false })}>
                    <Plus className="w-4 h-4 mr-2" /> New Course
                </Button>
            </div>

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
                                    <h3 className="font-bold text-lg">{course.course_name}</h3>
                                </div>
                                {course.is_published ? <Globe className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
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
        </div>
    );
}