// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/auth.ts'

// Type definitions for VSCode compatibility
declare const Deno: any

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null

interface User {
	id: string
	email: string
	role: string
}

function jsonResponse(body: Json, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		status
	})
}

// This function resets demo tenant data and seeds minimal sample records
Deno.serve(async (req) => {
	// Handle preflight request
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}

	try {
		// Validate secret parameter for cronjob authentication
		const url = new URL(req.url)
		const secret = url.searchParams.get('secret')
		const expectedSecret = Deno.env.get('CRONJOB_SECRET') || ''
		// Optional dry-run support: if enabled, the function will not perform deletions
		const dryRun = url.searchParams.get('dry_run') === '1' || url.searchParams.get('mode') === 'dry-run'

		if (!secret || !expectedSecret || secret !== expectedSecret) {
			return jsonResponse({ error: 'Unauthorized - Invalid or missing secret' }, 401)
		}

		const supabase = createSupabaseClient()
		console.log('[demo-reset] starting reset', { dryRun })

		// Demo owner email (can be overridden via secret)
		const demoEmail = Deno.env.get('DEMO_EMAIL') || 'demo@idcashier.my.id'

		// Find demo owner user
		const { data: demoOwner, error: ownerError } = await supabase
			.from('users')
			.select('id, email, role')
			.eq('email', demoEmail)
			.single<User>()

		if (ownerError || !demoOwner) {
			// If demo user not found, skip gracefully
			return jsonResponse({ success: true, message: 'Demo user not found, skipping reset', email: demoEmail })
		}

		// Get all user ids in the demo tenant (owner + cashiers)
		const { data: tenantUsers, error: tenantErr } = await supabase
			.from('users')
			.select('id')
			.or(`id.eq.${demoOwner.id},tenant_id.eq.${demoOwner.id}`)

		if (tenantErr) {
			throw tenantErr
		}

		const userIds = (tenantUsers || []).map((u: { id: string }) => u.id)
		if (!userIds.length) {
			return jsonResponse({ success: true, message: 'No tenant users found for demo account' })
		}

	// 1) Delete employees and related data first (to avoid FK issues)
	// Get all employee IDs for the tenant - use count to verify we got all records
	const { data: employees, error: empQueryErr, count: empCount } = await supabase
		.from('employees')
		.select('id, user_id', { count: 'exact' })
		.eq('tenant_id', demoOwner.id)
	
	if (empQueryErr) {
		console.error('[demo-reset] Error querying employees:', empQueryErr)
		throw empQueryErr
	}
	
	const employeeIds = (employees || []).map((e: { id: string }) => e.id)
	const employeeUserIds = (employees || [])
		.filter((e: { user_id: string | null }) => e.user_id !== null)
		.map((e: { user_id: string }) => e.user_id)
	console.log('[demo-reset] employees found', { employees: employeeIds.length, expectedCount: empCount, employeeUsers: employeeUserIds.length })
	
	if (!dryRun && employeeIds.length > 0) {
		// Delete employee attendance (with error checking)
		const { error: attErr } = await supabase.from('employee_attendance').delete().in('employee_id', employeeIds)
		if (attErr) {
			console.error('[demo-reset] Error deleting employee_attendance:', attErr)
			throw attErr
		}
		console.log('[demo-reset] Deleted employee_attendance by employee_id')
		
		// Delete employee leave requests
		const { error: leaveErr } = await supabase.from('employee_leave_requests').delete().in('employee_id', employeeIds)
		if (leaveErr) {
			console.error('[demo-reset] Error deleting employee_leave_requests:', leaveErr)
			throw leaveErr
		}
		console.log('[demo-reset] Deleted employee_leave_requests')
		
		// Delete employee salary adjustments
		const { error: salaryErr } = await supabase.from('employee_salary_adjustments').delete().in('employee_id', employeeIds)
		if (salaryErr) {
			console.error('[demo-reset] Error deleting employee_salary_adjustments:', salaryErr)
			throw salaryErr
		}
		console.log('[demo-reset] Deleted employee_salary_adjustments')
		
		// Delete employee product shares
		const { error: sharesErr } = await supabase.from('employee_product_shares').delete().in('employee_id', employeeIds)
		if (sharesErr) {
			console.error('[demo-reset] Error deleting employee_product_shares:', sharesErr)
			throw sharesErr
		}
		console.log('[demo-reset] Deleted employee_product_shares')
		
		// Delete profit shares
		const { error: profitErr } = await supabase.from('profit_shares').delete().in('employee_id', employeeIds)
		if (profitErr) {
			console.error('[demo-reset] Error deleting profit_shares:', profitErr)
			throw profitErr
		}
		console.log('[demo-reset] Deleted profit_shares')
		
		// Delete device employee mappings (mapping device PIN ke employee)
		const { error: deviceErr } = await supabase.from('device_employee_mappings').delete().in('employee_id', employeeIds)
		if (deviceErr) {
			console.error('[demo-reset] Error deleting device_employee_mappings:', deviceErr)
			throw deviceErr
		}
		console.log('[demo-reset] Deleted device_employee_mappings')
		
		// Delete attendance logs (raw logs dari mesin absensi)
		const { error: logsErr } = await supabase.from('attendance_logs').delete().in('employee_id', employeeIds)
		if (logsErr) {
			console.error('[demo-reset] Error deleting attendance_logs:', logsErr)
			throw logsErr
		}
		console.log('[demo-reset] Deleted attendance_logs by employee_id')
	}
	
	// Delete employees (with error checking)
	if (!dryRun) {
		const { error: empErr } = await supabase.from('employees').delete().eq('tenant_id', demoOwner.id)
		if (empErr) {
			console.error('[demo-reset] Error deleting employees:', empErr)
			throw empErr
		}
		console.log('[demo-reset] Deleted employees')
		
		// Verification: Check if any employees still exist
		const { data: remainingEmployees, error: verifyErr } = await supabase
			.from('employees')
			.select('id', { count: 'exact' })
			.eq('tenant_id', demoOwner.id)
		if (verifyErr) {
			console.warn('[demo-reset] Verification query failed:', verifyErr)
		} else {
			const remainingCount = remainingEmployees?.length || 0
			if (remainingCount > 0) {
				console.error(`[demo-reset] WARNING: ${remainingCount} employees still exist after deletion!`)
				throw new Error(`Failed to delete all employees: ${remainingCount} remaining`)
			}
			console.log('[demo-reset] Verified: All employees deleted')
		}
		
		// Backup deletion: After employees are deleted, use original employeeIds to clean up any orphaned records
		// This handles cases where attendance records exist but their employee was deleted
		if (employeeIds.length > 0) {
			// Try one more pass with original employeeIds to catch any missed records
			const { error: attBackupErr } = await supabase
				.from('employee_attendance')
				.delete()
				.in('employee_id', employeeIds)
			if (attBackupErr) {
				console.warn('[demo-reset] Backup employee_attendance deletion (orphaned):', attBackupErr)
			} else {
				console.log('[demo-reset] Backup: Attempted to delete orphaned employee_attendance')
			}
			
			const { error: logsBackupErr } = await supabase
				.from('attendance_logs')
				.delete()
				.in('employee_id', employeeIds)
			if (logsBackupErr) {
				console.warn('[demo-reset] Backup attendance_logs deletion (orphaned):', logsBackupErr)
			} else {
				console.log('[demo-reset] Backup: Attempted to delete orphaned attendance_logs')
			}
		}
		
		// Verification: Check if any attendance records still exist for the original employeeIds
		if (employeeIds.length > 0) {
			const { data: remainingAtt, error: attVerifyErr } = await supabase
				.from('employee_attendance')
				.select('id', { count: 'exact' })
				.in('employee_id', employeeIds)
			if (attVerifyErr) {
				console.warn('[demo-reset] Attendance verification query failed:', attVerifyErr)
			} else {
				const remainingAttCount = remainingAtt?.length || 0
				if (remainingAttCount > 0) {
					console.error(`[demo-reset] WARNING: ${remainingAttCount} attendance records still exist after deletion!`)
					// Try one more time with direct deletion
					const { error: finalAttErr } = await supabase
						.from('employee_attendance')
						.delete()
						.in('employee_id', employeeIds)
					if (finalAttErr) {
						throw new Error(`Failed to delete all attendance: ${remainingAttCount} remaining, error: ${finalAttErr.message}`)
					}
					console.log('[demo-reset] Second attempt: Deleted remaining attendance records')
				} else {
					console.log('[demo-reset] Verified: All attendance records deleted')
				}
			}
		}
	}
	
	// Delete cashier/manager users from auth.users (Supabase Auth)
	// These are employees who have user_id (app access)
	if (!dryRun && employeeUserIds.length > 0) {
		console.log(`Deleting ${employeeUserIds.length} cashier/manager accounts from Supabase Auth...`)
		for (const userId of employeeUserIds) {
			try {
				const { error } = await supabase.auth.admin.deleteUser(userId)
				if (error) {
					console.error(`Error deleting user ${userId} from Auth:`, error.message)
					// Continue with other deletions even if one fails
				}
			} catch (err) {
				console.error(`Exception deleting user ${userId}:`, err)
			}
		}
		
		// Also delete from public.users table (in case there's data inconsistency)
		await supabase.from('users').delete().in('id', employeeUserIds)
	}
	
	// Delete all cashier users in demo tenant (backup cleanup)
	// This catches any cashiers not linked to employees
	const { data: cashierUsers } = await supabase
		.from('users')
		.select('id')
		.eq('tenant_id', demoOwner.id)
		.eq('role', 'cashier')
	
	const cashierUserIds = (cashierUsers || []).map((u: { id: string }) => u.id)
	console.log('[demo-reset] cashier users found', { cashierUsers: cashierUserIds.length })
	
	if (!dryRun && cashierUserIds.length > 0) {
		console.log(`Deleting ${cashierUserIds.length} additional cashier accounts...`)
		// Delete from Supabase Auth
		for (const userId of cashierUserIds) {
			try {
				await supabase.auth.admin.deleteUser(userId)
			} catch (err) {
				console.error(`Error deleting cashier ${userId}:`, err)
			}
		}
		// Delete from users table
		await supabase.from('users').delete().in('id', cashierUserIds)
	}

	// 2) Delete transactional data (sales cascades sale_items)
	const { error: delSalesErr } = dryRun ? { error: null } as any : await supabase
		.from('sales')
		.delete()
		.in('user_id', userIds)
	if (delSalesErr) throw delSalesErr

	// 3) Delete returns and return_items
	if (!dryRun) await supabase.from('returns').delete().in('user_id', userIds)

	// 4) Delete expenses and expense categories
	if (!dryRun) await supabase.from('expenses').delete().eq('tenant_id', demoOwner.id)
	if (!dryRun) await supabase.from('expense_categories').delete().eq('tenant_id', demoOwner.id)

	// 5) Delete HPP-related data
	if (!dryRun) await supabase.from('global_hpp').delete().in('user_id', userIds)
	if (!dryRun) await supabase.from('raw_materials').delete().in('user_id', userIds)
	
	// Get all product IDs for the demo tenant before deleting related data
	const { data: products } = await supabase
		.from('products')
		.select('id')
		.in('user_id', userIds)
	
	const productIds = (products || []).map((p: { id: string }) => p.id)
	console.log('[demo-reset] products found', { products: productIds.length })
	
	// Delete product recipes and HPP breakdown only for demo tenant products
	if (!dryRun && productIds.length > 0) {
		await supabase.from('product_recipes').delete().in('product_id', productIds)
		await supabase.from('product_hpp_breakdown').delete().in('product_id', productIds)
	}

	// 6) Delete app settings
	if (!dryRun) await supabase.from('app_settings').delete().in('user_id', userIds)

	// 7) Delete attendance-related data (backup cleanup by tenant_id)
	// Delete device employee mappings by tenant (backup cleanup if any missed)
	if (!dryRun) {
		const { error: deviceTenantErr } = await supabase.from('device_employee_mappings').delete().eq('tenant_id', demoOwner.id)
		if (deviceTenantErr) {
			console.error('[demo-reset] Error deleting device_employee_mappings by tenant:', deviceTenantErr)
			// Don't throw - this is backup cleanup, continue
		} else {
			console.log('[demo-reset] Backup: Deleted device_employee_mappings by tenant_id')
		}
	}
	
	// Delete attendance logs by tenant (backup cleanup if any missed)
	if (!dryRun) {
		const { error: logsTenantErr } = await supabase.from('attendance_logs').delete().eq('tenant_id', demoOwner.id)
		if (logsTenantErr) {
			console.error('[demo-reset] Error deleting attendance_logs by tenant:', logsTenantErr)
			// Don't throw - this is backup cleanup, continue
		} else {
			console.log('[demo-reset] Backup: Deleted attendance_logs by tenant_id')
		}
	}
	
	// Final backup cleanup: Delete any remaining employee_attendance that might be orphaned
	// This handles cases where employee was deleted but attendance records remain
	if (!dryRun) {
		// Method 1: Try to delete using a SQL query that joins employees table
		// Since Supabase client doesn't support subqueries, we'll query employees first
		const { data: finalEmployees } = await supabase
			.from('employees')
			.select('id')
			.eq('tenant_id', demoOwner.id)
		const finalEmployeeIds = (finalEmployees || []).map((e: { id: string }) => e.id)
		
		// Try to delete any remaining attendance records using employee IDs from employees table
		if (finalEmployeeIds.length > 0) {
			const { error: finalAttErr } = await supabase
				.from('employee_attendance')
				.delete()
				.in('employee_id', finalEmployeeIds)
			if (finalAttErr) {
				console.warn('[demo-reset] Final backup employee_attendance deletion:', finalAttErr)
			} else {
				console.log('[demo-reset] Final backup: Deleted any remaining employee_attendance by employee_id')
			}
		}
		
		// Method 2: Direct deletion attempt using RPC function if available, or manual SQL
		// For now, we'll rely on the tenant-level backup below
	}
	
	// Delete devices
	if (!dryRun) await supabase.from('devices').delete().eq('tenant_id', demoOwner.id)

	// 8) Delete masters owned by tenant
	const deletions = [
		{ table: 'products', column: 'user_id' },
		{ table: 'categories', column: 'user_id' },
		{ table: 'suppliers', column: 'user_id' },
		{ table: 'customers', column: 'user_id' },
	]
	for (const d of deletions) {
		const { error } = dryRun ? { error: null } as any : await supabase.from(d.table).delete().in(d.column, userIds)
		if (error) throw error
	}

		// Seed minimal dataset for demo tenant (employees/attendance are gated and disabled by default)
		const supplierId = crypto.randomUUID()
		const categoryId = crypto.randomUUID()
		const productId = crypto.randomUUID()
		const customerId = crypto.randomUUID()

		// Insert supplier
		{
			const { error } = dryRun ? { error: null } as any : await supabase
				.from('suppliers')
				.insert([{ id: supplierId, user_id: demoOwner.id, name: 'PT. BAROKAH', address: 'Jakarta', phone: '021-000000' }])
			if (error) throw error
		}

		// Insert category
		{
			const { error } = dryRun ? { error: null } as any : await supabase
				.from('categories')
				.insert([{ id: categoryId, user_id: demoOwner.id, name: 'SNACK' }])
			if (error) throw error
		}

		// Insert product
		{
			const { error } = dryRun ? { error: null } as any : await supabase
				.from('products')
				.insert([{ id: productId, user_id: demoOwner.id, name: 'SOSIS', category_id: categoryId, supplier_id: supplierId, price: 2000, cost: 1500, stock: 100, barcode: '8999999999999' }])
			if (error) throw error
		}

		// Insert default customer (optional)
		{
			const { error } = dryRun ? { error: null } as any : await supabase
				.from('customers')
				.insert([{ id: customerId, user_id: demoOwner.id, name: 'Pelanggan Umum', email: null, phone: null }])
			if (error) throw error
		}

		// Optional: Seed employees and attendance only if explicitly enabled
		if (Deno.env.get('DEMO_SEED_EMPLOYEES') === 'true' && !dryRun) {
			// Intentionally disabled by default
		}

		const summary = {
			employees: employeeIds.length,
			employeeUsers: employeeUserIds.length,
			cashierUsers: cashierUserIds.length,
			products: productIds.length
		}
		console.log('[demo-reset] completed', { dryRun, summary })
		return jsonResponse({ success: true, message: dryRun ? 'Dry run completed (no changes applied)' : 'Demo data reset completed', email: demoEmail, dryRun, summary })
	} catch (error) {
		console.error('Demo reset error:', error)
		return jsonResponse({ error: 'Internal server error' }, 500)
	}
})


