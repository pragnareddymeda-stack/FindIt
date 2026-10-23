import { Link } from 'react-router-dom';

const Block = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="mt-2 space-y-2 text-slate-700">{children}</div>
  </section>
);

export default function Safety() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Safety guidelines</h1>
        <p className="mt-2 text-slate-600">FindIt connects people who lost things with people who found them. A few habits keep everyone safe.</p>
      </header>

      <Block title="Meeting to hand something over">
        <ul className="list-disc space-y-1 pl-5">
          <li>Meet in a busy, well-lit public place such as a library entrance, a security desk or a canteen, during the day.</li>
          <li>Tell a friend where you are going and when. Bring someone with you if you can.</li>
          <li>Keep your home address and phone number private. Use FindIt messages until you are comfortable.</li>
          <li>Never pay money, share passwords or OTPs, or click links to get an item back. FindIt will never ask for these.</li>
        </ul>
      </Block>

      <Block title="If you found something">
        <ul className="list-disc space-y-1 pl-5">
          <li>Describe the item in general terms. Keep unique details (a card name, a scratch, an engraving) for the private questions.</li>
          <li>Write verification questions only the owner could answer, and use more than one.</li>
          <li>Approve a claim only when the answers convince you. A match score never proves ownership.</li>
          <li>For ID cards, bank cards and documents, consider handing them to the issuing office or campus security instead.</li>
        </ul>
      </Block>

      <Block title="If you are claiming something">
        <ul className="list-disc space-y-1 pl-5">
          <li>Answer from memory and be specific. Do not guess or copy details from the public listing.</li>
          <li>Be patient. The finder may ask for more evidence before approving.</li>
          <li>Confirm receipt only when the item is actually in your hands.</li>
        </ul>
      </Block>

      <Block title="What verification can and cannot do">
        <p>
          Answering private questions makes it much harder for someone to claim an item that is not theirs, but it cannot give absolute
          proof. People can still guess, or learn details from someone else. That is why finders should use several pieces of evidence
          and hand items over in person, in public.
        </p>
      </Block>

      <Block title="Reporting problems">
        <ul className="list-disc space-y-1 pl-5">
          <li>Use <strong>Report this listing</strong> on any report that looks like spam, a scam, or shows private information.</li>
          <li>If a handover goes wrong, use <strong>Report a problem</strong> on the handover page so an administrator can review it.</li>
          <li>In an emergency or if you feel unsafe, contact campus security or local emergency services first.</li>
        </ul>
      </Block>

      <p className="text-sm text-slate-500">
        Ready to help? <Link to="/items" className="font-medium text-brand-700 hover:underline">Browse reports</Link> or{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">create an account</Link>.
      </p>
    </main>
  );
}
