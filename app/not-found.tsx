import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen w-full bg-[#000000] text-[#d0d0d0] flex flex-col items-center justify-center p-4 font-mono select-none">
      <div className="max-w-lg w-full bg-[#101010] border-2 border-[#ff0000] p-6 text-center space-y-4">
        <pre className="text-[#ff0099] text-xs leading-none">
{`+------------------------------------------------------+
|             [!] 404 · UNCHARTED CAVERN               |
+------------------------------------------------------+`}
        </pre>
        <p className="text-xs text-[#d0d0d0] leading-relaxed">
          The miners struck deep into the obsidian granite, but found only empty air. No such chamber exists in the royal archives.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="text-[#33ff00] hover:bg-[#202020] hover:text-[#ffffff] px-2 py-1 text-xs border border-[#202020] inline-block transition-colors whitespace-nowrap"
          >
            [ &lt;&lt; RETURN TO FORTRESS GATE ]
          </Link>
        </div>
      </div>
    </main>
  );
}

