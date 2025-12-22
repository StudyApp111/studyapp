import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  HelpCircle, Plus, Search, ThumbsUp, MessageCircle, 
  CheckCircle, Clock, ArrowLeft, Send, Loader2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ForumTab({ user }) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['forum-questions'],
    queryFn: () => base44.entities.ForumQuestion.list('-created_date', 50)
  });

  const createQuestionMutation = useMutation({
    mutationFn: (data) => base44.entities.ForumQuestion.create({
      ...data,
      author_name: user?.full_name || "Anonymous",
      author_email: user?.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-questions'] });
      setShowCreateModal(false);
    }
  });

  const upvoteMutation = useMutation({
    mutationFn: async (question) => {
      const alreadyUpvoted = question.upvoted_by?.includes(user?.email);
      const newUpvotedBy = alreadyUpvoted
        ? question.upvoted_by.filter(e => e !== user?.email)
        : [...(question.upvoted_by || []), user?.email];
      
      await base44.entities.ForumQuestion.update(question.id, {
        upvotes: newUpvotedBy.length,
        upvoted_by: newUpvotedBy
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-questions'] })
  });

  const subjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];
  
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          q.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = filterSubject === "all" || q.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  if (activeQuestion) {
    return (
      <QuestionDetail
        question={activeQuestion}
        user={user}
        onBack={() => {
          setActiveQuestion(null);
          queryClient.invalidateQueries({ queryKey: ['forum-questions'] });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Ask Question
          </Button>
        </div>
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No questions yet</h3>
          <p className="text-sm text-slate-500 mb-4">Be the first to ask!</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600">
            <Plus className="w-4 h-4 mr-2" />
            Ask Question
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((question, idx) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white rounded-xl border hover:shadow-md transition-all p-4 cursor-pointer"
              onClick={() => setActiveQuestion(question)}
            >
              <div className="flex gap-4">
                {/* Upvote */}
                <div 
                  className="flex flex-col items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    upvoteMutation.mutate(question);
                  }}
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-8 w-8 p-0 ${question.upvoted_by?.includes(user?.email) ? 'text-purple-600' : ''}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">{question.upvotes || 0}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 hover:text-purple-700 transition-colors line-clamp-1">
                      {question.title}
                    </h3>
                    {question.is_resolved && (
                      <Badge className="bg-green-100 text-green-700 shrink-0">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-2">{question.content}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {question.subject && (
                      <Badge variant="outline" className="text-[10px]">{question.subject}</Badge>
                    )}
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {question.answer_count || 0} answers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(question.created_date).toLocaleDateString()}
                    </span>
                    <span>by {question.author_name || "Anonymous"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Question Modal */}
      <CreateQuestionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createQuestionMutation.mutate(data)}
        isLoading={createQuestionMutation.isPending}
      />
    </div>
  );
}

function QuestionDetail({ question, user, onBack }) {
  const queryClient = useQueryClient();
  const [answerText, setAnswerText] = useState("");

  const { data: answers = [], isLoading } = useQuery({
    queryKey: ['question-answers', question.id],
    queryFn: () => base44.entities.ForumAnswer.filter({ question_id: question.id })
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (content) => {
      await base44.entities.ForumAnswer.create({
        question_id: question.id,
        content,
        author_name: user?.full_name || "Anonymous",
        author_email: user?.email
      });
      await base44.entities.ForumQuestion.update(question.id, {
        answer_count: (question.answer_count || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-answers', question.id] });
      setAnswerText("");
    }
  });

  const acceptAnswerMutation = useMutation({
    mutationFn: async (answer) => {
      await base44.entities.ForumAnswer.update(answer.id, { is_accepted: true });
      await base44.entities.ForumQuestion.update(question.id, { is_resolved: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-answers', question.id] });
    }
  });

  const sortedAnswers = [...answers].sort((a, b) => {
    if (a.is_accepted) return -1;
    if (b.is_accepted) return 1;
    return (b.upvotes || 0) - (a.upvotes || 0);
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to questions
      </Button>

      {/* Question */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">{question.title}</h2>
          {question.is_resolved && (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolved
            </Badge>
          )}
        </div>
        <p className="text-slate-700 whitespace-pre-wrap mb-4">{question.content}</p>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {question.subject && <Badge variant="outline">{question.subject}</Badge>}
          <span>Asked by {question.author_name || "Anonymous"}</span>
          <span>•</span>
          <span>{new Date(question.created_date).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : (
          sortedAnswers.map((answer) => (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl border p-5 ${answer.is_accepted ? 'ring-2 ring-green-500' : ''}`}
            >
              {answer.is_accepted && (
                <Badge className="bg-green-100 text-green-700 mb-3">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Accepted Answer
                </Badge>
              )}
              <p className="text-slate-700 whitespace-pre-wrap mb-3">{answer.content}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>by {answer.author_name || "Anonymous"}</span>
                  <span>•</span>
                  <span>{new Date(answer.created_date).toLocaleDateString()}</span>
                </div>
                {question.author_email === user?.email && !question.is_resolved && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => acceptAnswerMutation.mutate(answer)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Answer Form */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Your Answer</h3>
        <Textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder="Share your knowledge..."
          rows={4}
          className="mb-3"
        />
        <Button 
          onClick={() => submitAnswerMutation.mutate(answerText)}
          disabled={!answerText.trim() || submitAnswerMutation.isPending}
          className="bg-purple-600"
        >
          {submitAnswerMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Post Answer
        </Button>
      </div>
    </div>
  );
}

function CreateQuestionModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, content, subject });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Question Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need help with?"
              required
            />
          </div>
          <div>
            <Label>Subject (optional)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Biology, Math"
            />
          </div>
          <div>
            <Label>Details</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Explain your question in detail..."
              rows={4}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-purple-600" disabled={!title || !content || isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Post Question
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}