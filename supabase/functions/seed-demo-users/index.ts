import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Starting seed process...')

    // Check if users already exist
    const { data: existingUsers } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .in('email', ['admin@example.com', 'alice@example.com', 'bob@example.com'])

    if (existingUsers && existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Demo users already exist. Seed has already been run.',
          existing: existingUsers.map(u => u.email)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create demo users
    const demoUsers = [
      { email: 'admin@example.com', password: 'Admin123!', role: 'admin', full_name: 'Admin User', department: 'Management', position: 'System Administrator' },
      { email: 'alice@example.com', password: 'Employee123!', role: 'employee', full_name: 'Alice Johnson', department: 'Engineering', position: 'Senior Developer' },
      { email: 'bob@example.com', password: 'Employee123!', role: 'employee', full_name: 'Bob Smith', department: 'Sales', position: 'Sales Manager' }
    ]

    const createdUserIds: { [key: string]: string } = {}

    for (const user of demoUsers) {
      console.log(`Creating user: ${user.email}`)
      
      // Create user in auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name
        }
      })

      if (authError) {
        console.error(`Error creating ${user.email}:`, authError)
        throw authError
      }

      createdUserIds[user.email] = authData.user.id

      // Update profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: user.full_name,
          department: user.department,
          position: user.position,
          hire_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`
        })
        .eq('id', authData.user.id)

      if (profileError) {
        console.error(`Error updating profile for ${user.email}:`, profileError)
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: user.role
        })

      if (roleError) {
        console.error(`Error assigning role for ${user.email}:`, roleError)
        throw roleError
      }

      console.log(`✓ Created ${user.email} with role ${user.role}`)
    }

    // Seed sample leave requests
    const leaveRequests = [
      {
        employee_id: createdUserIds['alice@example.com'],
        leave_type: 'vacation',
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        days_count: 7,
        reason: 'Family vacation',
        status: 'pending'
      },
      {
        employee_id: createdUserIds['bob@example.com'],
        leave_type: 'sick',
        start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        days_count: 2,
        reason: 'Medical appointment',
        status: 'approved',
        reviewed_by: createdUserIds['admin@example.com'],
        reviewed_at: new Date().toISOString()
      }
    ]

    const { error: leavesError } = await supabaseAdmin
      .from('leaves')
      .insert(leaveRequests)

    if (leavesError) {
      console.error('Error seeding leaves:', leavesError)
    } else {
      console.log('✓ Seeded leave requests')
    }

    // Seed sample attendance records
    const attendanceRecords = []
    const today = new Date()
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      for (const email of ['alice@example.com', 'bob@example.com']) {
        const checkIn = new Date(date)
        checkIn.setHours(9, Math.floor(Math.random() * 30), 0)
        
        const checkOut = new Date(date)
        checkOut.setHours(17, Math.floor(Math.random() * 60), 0)
        
        attendanceRecords.push({
          employee_id: createdUserIds[email],
          date: date.toISOString().split('T')[0],
          check_in: checkIn.toISOString(),
          check_out: checkOut.toISOString(),
          status: 'present'
        })
      }
    }

    const { error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .insert(attendanceRecords)

    if (attendanceError) {
      console.error('Error seeding attendance:', attendanceError)
    } else {
      console.log('✓ Seeded attendance records')
    }

    // Log seed activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: createdUserIds['admin@example.com'],
        action: 'seed',
        entity_type: 'system',
        entity_id: createdUserIds['admin@example.com'],
        description: 'Demo data seeded successfully'
      })

    return new Response(
      JSON.stringify({ 
        message: 'Demo users and sample data created successfully!',
        users: demoUsers.map(u => ({ email: u.email, role: u.role })),
        credentials: {
          admin: 'admin@example.com / Admin123!',
          employees: 'alice@example.com / Employee123!, bob@example.com / Employee123!'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Seed error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
