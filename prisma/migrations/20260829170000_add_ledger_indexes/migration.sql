-- CreateIndex
CREATE INDEX " payments_schoolId_paidAt_idx\ ON \payments\(\schoolId\, \paidAt\);

-- CreateIndex
CREATE INDEX \expenses_schoolId_expenseDate_idx\ ON \expenses\(\schoolId\, \expenseDate\);

-- CreateIndex
CREATE INDEX \expenses_schoolId_deletedAt_idx\ ON \expenses\(\schoolId\, \deletedAt\);

-- CreateIndex
CREATE INDEX \budget_audit_logs_budgetId_changedAt_idx\ ON \budget_audit_logs\(\budgetId\, \changedAt\);
