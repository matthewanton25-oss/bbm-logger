import FuelLogForm from "@/components/FuelLogForm";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-700">
      {/* Header */}
      <div className="px-6 pt-10 pb-8 text-white">
        <div className="text-4xl mb-2">⛽</div>
        <h1 className="text-2xl font-bold leading-tight">Log BBM Kapal</h1>
        <p className="text-blue-200 text-sm mt-1">Catat pengisian bahan bakar</p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-t-3xl min-h-screen px-5 pt-7">
        <FuelLogForm />
      </div>
    </main>
  );
}
