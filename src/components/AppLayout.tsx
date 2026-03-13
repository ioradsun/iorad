import AppSidebar from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <main className="flex-1 min-w-0 px-6 py-8 max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  );
}
