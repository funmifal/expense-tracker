export const metadata = {
  title: 'Expense Tracker API',
  description: 'Task 1 REST API — expense, budget, category and payment-method resources',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
