import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const CustomerStory = React.lazy(() => import("@/pages/CustomerStory"));
const CustomerList = React.lazy(() => import("@/pages/CustomerList"));
const LoginPage = React.lazy(() => import("@/pages/LoginPage"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const UploadPage = React.lazy(() => import("@/pages/Upload"));
const CompanyDetail = React.lazy(() => import("@/pages/CompanyDetail"));
const AdminSettings = React.lazy(() => import("@/pages/AdminSettings"));
const JobHistory = React.lazy(() => import("@/pages/JobHistory"));
const InternalSignals = React.lazy(() => import("@/pages/InternalSignals"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }
            >
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/stories" element={<CustomerList />} />
                <Route path="/stories/:companySlug/:contactSlug" element={<CustomerStory />} />
                <Route path="/stories/:id" element={<CustomerStory />} />
                <Route path="/:partner/:customer/stories/:contactName" element={<CustomerStory />} />
                <Route path="/:partner/:customer/stories" element={<CustomerStory />} />

                {/* Protected routes */}
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/upload" element={<UploadPage />} />
                          <Route path="/company/:id" element={<CompanyDetail />} />
                          <Route path="/settings" element={<AdminSettings />} />
                          <Route path="/signals" element={<InternalSignals />} />
                          <Route path="/jobs" element={<JobHistory />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
