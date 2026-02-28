'use client'

import Link from 'next/link'

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">VA Portal Help</h1>
            <p className="text-gray-600 mt-2">
              This portal is the single source of truth for tasks. If it isn’t in a ticket, it isn’t official work.
            </p>
          </div>

          <Link className="underline text-sm mt-2" href="/my-work">
            Go to My Work →
          </Link>
        </div>

        {/* Quick Start */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Quick Start</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-800">
            <li>Log in with your VA credentials.</li>
            <li>
              Go to <b>My Work</b> to see your assigned tickets.
            </li>
            <li>
              Click a ticket title to open the full instructions, links, checklist, and Definition of Done.
            </li>
            <li>
              Use <b>Comments</b> inside the ticket to ask questions or post progress updates.
            </li>
            <li>
              Update <b>Status</b> and <b>Due Date</b> as the work progresses (if you have access to edit).
            </li>
          </ol>
        </section>

        {/* Golden Rules */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Golden Rules</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-800">
            <li>
              <b>Work only from tickets.</b> DMs and random messages are not task requests.
            </li>
            <li>
              <b>Ask questions in ticket comments</b> (keeps context and history in one place).
            </li>
            <li>
              <b>Don’t browse client lists.</b> You will receive everything you need inside the ticket.
            </li>
            <li>
              <b>If a credential/link is missing</b>, comment and request it. Do not guess.
            </li>
            <li>
              <b>Confirm deliverables:</b> Always match the Definition of Done before marking as done.
            </li>
          </ul>
        </section>

        {/* Navigation */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Pages & Navigation</h2>
          <div className="space-y-3 text-gray-800">
            <div>
              <b>My Work</b> (VA main page): Your assigned tickets only. Start here every day.
            </div>
            <div>
              <b>Tickets</b>: List view of tickets you’re allowed to see. Use to search/scan.
            </div>
            <div>
              <b>Board</b>: Kanban-style view (Backlog → In Progress → Done). Useful for visual workflow.
            </div>
            <div>
              <b>Clients</b> (Admin only): Admin stores client metadata here. VAs don’t need this page.
            </div>
            <div>
              <b>Templates</b> (Admin only): Admin creates repeatable “task recipes” to generate clean tickets fast.
            </div>
          </div>
        </section>

        {/* Ticket Structure */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Ticket Structure</h2>
          <p className="text-gray-800 mb-4">
            Every ticket is written in a consistent format. This makes instructions predictable and reduces back-and-forth.
          </p>

          <div className="space-y-4 text-gray-800">
            <div>
              <h3 className="font-semibold">1) Context</h3>
              <p className="text-gray-700">
                Why this task exists, background details, and the intent. Read this first.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">2) Checklist</h3>
              <p className="text-gray-700">
                The step-by-step instructions. On the ticket page, these render as UI checkboxes for convenience.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Note: checklist checkmarks are UI-only and do not persist after refresh (by design).
              </p>
            </div>

            <div>
              <h3 className="font-semibold">3) Links & Access</h3>
              <p className="text-gray-700">
                All required URLs should be here (website, WP admin, Drive folder, sheets, docs, etc.). If anything is
                missing, comment on the ticket.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">4) Definition of Done</h3>
              <p className="text-gray-700">
                The completion criteria. If you’re unsure whether the task is “done,” compare your output to this section.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">5) Notes</h3>
              <p className="text-gray-700">
                Edge cases, special rules, formatting requirements, naming conventions, or “do not touch” warnings.
              </p>
            </div>
          </div>
        </section>

        {/* Status Workflow */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Status Workflow (Recommended)</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-800">
            <li>
              <b>backlog</b>: Not started yet.
            </li>
            <li>
              <b>ready</b>: Clear instructions + all links available; can be started.
            </li>
            <li>
              <b>in_progress</b>: Actively being worked on.
            </li>
            <li>
              <b>blocked</b>: Cannot proceed (missing access, waiting on input). Comment what’s needed.
            </li>
            <li>
              <b>review</b>: Work complete but awaiting admin review/approval.
            </li>
            <li>
              <b>done</b>: Meets Definition of Done; deliverables provided.
            </li>
            <li>
              <b>archived</b>: Old/closed items kept for records.
            </li>
          </ul>
        </section>

        {/* Comments & Updates */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">How to Post Updates</h2>
          <p className="text-gray-800 mb-3">
            Use ticket comments for everything. A good update is short, specific, and includes links.
          </p>

          <div className="border rounded p-4 bg-gray-50 text-sm text-gray-800 whitespace-pre-wrap">
            Update format:
            {'\n'}
            - What I did
            {'\n'}
            - What I found (include link/screenshot if relevant)
            {'\n'}
            - What’s next
            {'\n'}
            - Any blockers + what I need from you
          </div>

          <p className="text-gray-700 mt-3">
            If needed, use <b>Copy Summary</b> on the ticket page to copy a clean status update to your clipboard.
          </p>
        </section>

        {/* Common Tasks */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Common Task Types</h2>
          <div className="space-y-3 text-gray-800">
            <div>
              <b>Web research</b>: Follow the checklist, keep source links, summarize clearly.
            </div>
            <div>
              <b>Data extraction</b>: Keep your output structured, validate totals, and flag anomalies.
            </div>
            <div>
              <b>Google Sheets</b>: Avoid breaking formulas; duplicate sheets before major edits.
            </div>
            <div>
              <b>WordPress</b>: Don’t install plugins or change themes without explicit ticket instruction.
            </div>
            <div>
              <b>Light coding</b>: Copy/paste carefully; comment what changed and where.
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Security & Access</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-800">
            <li>Never store passwords in comments unless instructed by admin.</li>
            <li>Never share credentials outside the portal/task instructions.</li>
            <li>If a login fails, comment with the error message and the exact URL you used.</li>
          </ul>
        </section>

        {/* Troubleshooting */}
        <section className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Troubleshooting</h2>
          <div className="space-y-3 text-gray-800">
            <div>
              <b>I can’t see my tickets:</b> Confirm you are logged into the correct account. Then ask admin to confirm the ticket is assigned to you.
            </div>
            <div>
              <b>I’m blocked:</b> Set status to <b>blocked</b> and comment what you need (link, credential, clarification).
            </div>
            <div>
              <b>A link is missing:</b> Comment on the ticket requesting the exact link/access needed.
            </div>
            <div>
              <b>Something looks wrong:</b> Add a comment with steps to reproduce and a screenshot if possible.
            </div>
          </div>
        </section>

        <div className="text-xs text-gray-500 mt-6">
          Portal docs are living. If you find a gap or repeated confusion, tell admin and we’ll update this page.
        </div>
      </div>
    </main>
  )
}