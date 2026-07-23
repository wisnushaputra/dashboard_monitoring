const http = require('http')

async function runTest() {
  console.log('====================================================')
  console.log('🚀 COMPREHENSIVE NOC DASHBOARD ALL-FEATURE TEST SUITE')
  console.log('====================================================')

  let token = ''
  let testNodeId = null
  let testCustomerId = null
  let testCustomerCode = ''
  let testRcaId = null
  let testShiftId = null

  const stats = { pass: 0, fail: 0 }

  function request(method, path, body = null, overrideToken = undefined) {
    return new Promise((resolve) => {
      const authToken = overrideToken !== undefined ? overrideToken : token
      const url = new URL(`http://localhost:4000/api${path}`)
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      }
      if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`
      }

      const req = http.request(options, (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          let data = raw
          try { data = JSON.parse(raw) } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, data })
        })
      })

      req.on('error', (err) => {
        resolve({ status: 500, data: { error: err.message } })
      })

      if (body) {
        req.write(JSON.stringify(body))
      }
      req.end()
    })
  }

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`)
      stats.pass++
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`)
      stats.fail++
    }
  }

  // 1. Authentication
  console.log('\n--- 1. Testing Authentication API ---')
  const loginRes = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' })
  assert('Login API', loginRes.status === 200 && loginRes.data.token)
  token = loginRes.data.token || ''

  const meRes = await request('GET', '/auth/me')
  assert('Get Current User (me)', meRes.status === 200 && meRes.data.username === 'admin')

  // 2. Nodes & Topology API
  console.log('\n--- 2. Testing Nodes & Topology API ---')
  const nodesRes = await request('GET', '/nodes')
  assert('List Topology Nodes', nodesRes.status === 200 && Array.isArray(nodesRes.data))
  if (Array.isArray(nodesRes.data) && nodesRes.data.length > 0) {
    const activeNode = nodesRes.data.find(n => n.id === 134) || nodesRes.data[0]
    testNodeId = activeNode.id
  }

  const nodesSummaryRes = await request('GET', '/events/summary')
  assert('Get System Summary Stats', nodesSummaryRes.status === 200 && nodesSummaryRes.data.totalNodes !== undefined)

  if (testNodeId) {
    const freezeRes = await request('PUT', `/nodes/${testNodeId}/toggle-freeze`, { enabled: true })
    assert('Node Freeze/Disable Toggle', freezeRes.status === 200 && freezeRes.data.status !== undefined)
    // Restore node to unfreeze / enabled state
    await request('PUT', `/nodes/${testNodeId}/toggle-freeze`, { enabled: false })
  }

  // 3. AI Anomaly & Flapping Engine
  console.log('\n--- 3. Testing AI Anomaly & Flapping Link Engine ---')
  const anomaliesRes = await request('GET', '/anomalies')
  assert('List AI Anomalies', anomaliesRes.status === 200 && Array.isArray(anomaliesRes.data))

  if (testNodeId) {
    const nodeAnomaliesRes = await request('GET', `/anomalies?nodeId=${testNodeId}`)
    assert('Get Node Diagnostic Anomalies', nodeAnomaliesRes.status === 200 && Array.isArray(nodeAnomaliesRes.data))
  }

  // 4. Config Backup & Diff Engine
  console.log('\n--- 4. Testing Config Backup & Diff Engine ---')
  if (testNodeId) {
    const fetchConfigRes = await request('POST', `/nodes/${testNodeId}/configs/backup`)
    assert('Fetch Device Config Backup', (fetchConfigRes.status === 200 || fetchConfigRes.status === 201) && (fetchConfigRes.data.id !== undefined || fetchConfigRes.data.version !== undefined))

    const listConfigsRes = await request('GET', `/nodes/${testNodeId}/configs`)
    assert('List Device Config History & Diff', listConfigsRes.status === 200 && Array.isArray(listConfigsRes.data))
  }

  // 5. Corporate Customers & Whitelabel Public Status Portal
  console.log('\n--- 5. Testing Corporate Customers & Public Status Portal ---')
  const custRes = await request('GET', '/customers')
  assert('List Corporate Customers', custRes.status === 200 && Array.isArray(custRes.data))
  if (Array.isArray(custRes.data) && custRes.data.length > 0) {
    testCustomerId = custRes.data[0].id
    testCustomerCode = custRes.data[0].code
  }

  if (testCustomerCode) {
    const publicRes = await request('GET', `/public/status/${testCustomerCode}`, null, '')
    assert('Unauthenticated Public Customer Status Portal', publicRes.status === 200 && (publicRes.data.customer || publicRes.data.customerName))
  }

  // 6. Telegram Bot Integration & Daily 8 PM Reporter
  console.log('\n--- 6. Testing Telegram Bot & Daily 8 PM Reporter ---')
  const teleTestRes = await request('POST', '/notifications/telegram/test-report')
  assert('Telegram Daily 8 PM Report Generation Engine', teleTestRes.status === 200 && teleTestRes.data.success === true)

  // 7. Incident Post-Mortem RCA PDF Generator
  console.log('\n--- 7. Testing Incident Post-Mortem RCA PDF Generator ---')
  if (testNodeId) {
    const rcaCreateRes = await request('POST', '/rca', {
      nodeId: testNodeId,
      title: 'Automated Test RCA Incident Report',
      rootCauseCategory: 'fiber_cut',
      rootCauseDescription: 'Automated test suite verification',
      executiveSummary: 'Verification of RCA engine',
      severity: 'major',
    })
    assert('Create Incident RCA Report', rcaCreateRes.status === 200 && rcaCreateRes.data.id !== undefined)
    if (rcaCreateRes.data && rcaCreateRes.data.id) {
      testRcaId = rcaCreateRes.data.id
    }
  }

  if (testRcaId) {
    const rcaPdfRes = await request('GET', `/rca/${testRcaId}/pdf`)
    assert('Generate & Stream Official RCA PDF Report', rcaPdfRes.status === 200 && String(rcaPdfRes.headers['content-type']).includes('application/pdf'))
  }

  // 8. NOC Duty Shift Handover Digital Logbook
  console.log('\n--- 8. Testing NOC Duty Shift Handover Logbook ---')
  const shiftSumRes = await request('GET', '/shifts/summary')
  assert('Get Live Shift Rotation Summary', shiftSumRes.status === 200 && shiftSumRes.data.currentShift !== undefined)

  const shiftCreateRes = await request('POST', '/shifts', {
    shiftName: 'morning',
    incomingOperatorName: 'Test Operator',
    handoverSummary: 'Automated test shift handover summary',
  })
  assert('Submit Shift Handover Entry', shiftCreateRes.status === 200 && shiftCreateRes.data.id !== undefined)
  if (shiftCreateRes.data && shiftCreateRes.data.id) {
    testShiftId = shiftCreateRes.data.id
  }

  if (testShiftId) {
    const shiftAckRes = await request('PUT', `/shifts/${testShiftId}/acknowledge`)
    assert('Incoming Operator Shift Sign-off Acknowledge', shiftAckRes.status === 200 && shiftAckRes.data.status === 'acknowledged')

    const shiftPdfRes = await request('GET', `/shifts/${testShiftId}/pdf`)
    assert('Generate & Stream Shift Logbook PDF', shiftPdfRes.status === 200 && String(shiftPdfRes.headers['content-type']).includes('application/pdf'))
  }

  // 9. Corporate SLA Penalty & Refund Calculator
  console.log('\n--- 9. Testing Corporate SLA Penalty & Refund Calculator ---')
  const slaCalcRes = await request('GET', '/sla-billing?monthYear=2026-07')
  assert('Calculate Monthly SLA Billing & Refunds', slaCalcRes.status === 200 && Array.isArray(slaCalcRes.data.customers))

  if (testCustomerId) {
    const slaPdfRes = await request('GET', `/sla-billing/pdf/${testCustomerId}?monthYear=2026-07`)
    assert('Generate & Stream SLA Refund Invoice PDF', slaPdfRes.status === 200 && String(slaPdfRes.headers['content-type']).includes('application/pdf'))
  }

  // 10. Reports & Excel Export API
  console.log('\n--- 10. Testing Reports & Excel Exporter API ---')
  const startDate = '2026-07-01'
  const endDate = '2026-07-24'

  if (testCustomerId) {
    const slaRepRes = await request('GET', `/reports/sla/preview?customerId=${testCustomerId}&startDate=${startDate}&endDate=${endDate}`)
    assert('Generate SLA Performance Analytics', slaRepRes.status === 200 && (slaRepRes.data.summary || slaRepRes.data.customerName))
  }

  const mttrRepRes = await request('GET', `/reports/mttr?startDate=${startDate}&endDate=${endDate}`)
  assert('Generate MTTR Incident Response Analytics', mttrRepRes.status === 200 && mttrRepRes.data.summary !== undefined)

  const excelRes = await request('GET', `/reports/mttr/xlsx?startDate=${startDate}&endDate=${endDate}`)
  assert('Generate & Stream Multi-Tab Excel Workbook (.xlsx)', excelRes.status === 200 && String(excelRes.headers['content-type']).includes('spreadsheetml'))

  console.log('\n====================================================')
  console.log(`📊 ALL-FEATURE TEST SUMMARY: ${stats.pass} PASSED, ${stats.fail} FAILED`)
  console.log('====================================================')

  if (stats.fail === 0) {
    console.log('🎉 ALL FEATURES ARE 100% WORKING WITHOUT ANY ERRORS!')
  } else {
    console.error('⚠️ SOME TESTS FAILED. PLEASE CHECK LOGS.')
  }
}

runTest()
