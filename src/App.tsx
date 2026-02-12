import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import CompanyDetail from "@/pages/CompanyDetail";
import AdminSettings from "@/pages/AdminSettings";
import JobHistory from "@/pages/JobHistory";
import CustomerList from "@/pages/CustomerList";
import CustomerStory from "@/pages/CustomerStory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/stories" element={<CustomerList />} />
          <Route path="/stories/:id" element={<CustomerStory />} />
          <Route path="*" element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/company/:id" element={<CompanyDetail />} />
                <Route path="/settings" element={<AdminSettings />} />
                <Route path="/jobs" element={<JobHistory />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
