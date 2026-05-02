# Core Clinical Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict Role-Based Access Control (RBAC) in financial modules and standardize dashboard analytics for accurate clinical revenue tracking.

**Architecture:** We will restrict sensitive UI components in the Billing and Settings routes to only render when `isOwner` is true. We'll update the Dashboard metrics to accurately filter paid vs pending invoices, and add a quick-access "Recent Payments" view.

**Tech Stack:** Next.js 15, React, Tailwind, Supabase

---

### Task 1: Secure Billing Tabs (RBAC)

**Files:**
- Modify: `app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Wrap sensitive TabsContent with isOwner check**

Locate `<TabsContent value="treatments">` and `<TabsContent value="settings">`. Wrap them in `{isOwner && ( ... )}` blocks.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/billing/page.tsx
git commit -m "sec(billing): restrict treatment and settings tab content to clinic owners"
```

### Task 2: Standardize Dashboard Financial Analytics

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Refactor revenue calculations**
Change the `monthlyRevenue` calculation to only sum `status === 'paid'`.
Add `pendingRevenue` for `status === 'pending'`.

```tsx
  // Calculate real stats
  const monthlyRevenue = billings
    .filter(b => b.status === 'paid')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

  const pendingRevenue = billings
    .filter(b => b.status === 'pending' || b.status === 'overdue')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
```

- [ ] **Step 2: Update the `allStats` array**
Update the "Ingresos del Mes" (monthly revenue) item, and add/replace the "Pendiente de Pago" item. Ensure `adminOnly: true` is on both.

```tsx
    {
      title: t("monthly-revenue") || "Ingresos del Mes",
      value: `$${monthlyRevenue.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      change: "+18%",
      icon: DollarSign,
      color: "text-green-600",
      adminOnly: true,
      href: "/billing"
    },
    {
      title: "Cuentas por Cobrar",
      value: `$${pendingRevenue.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "-5%",
      icon: CreditCard,
      color: "text-amber-600",
      adminOnly: true,
      href: "/billing"
    },
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): calculate accurate revenue metrics from paid and pending invoices"
```

### Task 3: Dashboard Recent Transactions Feed

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Get recent billings**
```tsx
  const recentBillings = [...billings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
```

- [ ] **Step 2: Create Recent Transactions UI**
Below the existing "Próximas Citas" card, add a "Transacciones Recientes" card, visible only to `clinic_owner`.

```tsx
        {/* Only show to owners */}
        {user?.role === "clinic_owner" && (
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <DollarSign className="w-5 h-5 text-green-600" />
                Transacciones Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentBillings.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No hay transacciones recientes registradas.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBillings.map((billing) => (
                    <div key={billing.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${billing.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{billing.description || "Consulta Médica"}</p>
                          <p className="text-xs text-slate-500">{format(new Date(billing.created_at), "dd MMM, yyyy", { locale: es })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800">${Number(billing.amount).toFixed(2)}</p>
                        <Badge variant={billing.status === 'paid' ? 'default' : 'secondary'} className="mt-1 text-[10px] uppercase">
                          {billing.status === 'paid' ? 'Pagado' : billing.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): add recent transactions feed for clinic owners"
```
