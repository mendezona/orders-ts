export default function HomePage() {
  const homepageText =
    "Hey there human :)! I’m up to my neck in stock charts and ticker symbols, trying to turn pennies into millions. Check back later, and I’ll be more than happy to help you out. In the meantime, keep dreaming of yachts and private jets!  💰";

  return (
    <main>
      <div className="flex h-screen items-center bg-gray-950">
        <h1 className="mx-auto bg-gradient-to-r from-orange-400 to-blue-400 bg-clip-text px-4 py-4 text-6xl font-bold text-transparent drop-shadow-lg md:px-6 md:py-6">
          {homepageText}
        </h1>
      </div>
    </main>
  );
}
