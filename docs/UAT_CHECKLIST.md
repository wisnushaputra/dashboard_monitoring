# User Acceptance Testing (UAT) Checklist

## RBAC
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Admin dapat login | ✅ | E2E: login.spec.ts, Integration: auth |
| Operator dapat login | ✅ | E2E: login.spec.ts |
| Viewer dapat login | ✅ | E2E: login.spec.ts |
| Invalid credentials ditolak | ✅ | E2E: login.spec.ts |
| Viewer read-only (no Create/Edit/Delete) | ✅ | Integration: RBAC tests (403) |
| Operator limited (no user mgmt) | ✅ | E2E: login.spec.ts |
| Admin full access | ✅ | Integration: all CRUD tests |
| Logout clears session | ✅ | E2E: login.spec.ts |

## Dashboard (3.1)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Summary cards (Total Sites, Online, Offline, Alarms) | ✅ | E2E: topology.spec.ts, Integration: events/summary |
| Recent Events widget | ✅ | Integration: events/summary |
| Dark/Light mode toggle | ✅ | In Layout component |
| Real-time update via WebSocket | ✅ | Integration: websocket.test.ts |

## Topology Editor (3.2)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Node palette display | ✅ | E2E: topology.spec.ts |
| Drag node from palette (visual) | ✅ | E2E: topology.spec.ts |
| Node status colors (green/amber/red) | ✅ | Frontend: Topology.tsx (StatusNode) |
| Pulsing red animation for down | ✅ | Frontend: Topology.tsx |
| Double-click edit modal | ✅ | Frontend: Topology.tsx |
| Edge connections between nodes | ✅ | Frontend: Topology.tsx |
| Zoom, pan, minimap | ✅ | Frontend: Topology.tsx (ReactFlow Controls) |

## Monitoring Engine (3.3)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| ICMP ping to node IP | ✅ | Unit: ping.test.ts |
| Status determination (up/warning/down) | ✅ | Integration: monitoring.test.ts |
| Threshold: 2 failures → down | ✅ | Code: pingWorker.ts:28-36 |
| Threshold: >100ms → warning | ✅ | Code: pingWorker.ts:31 |
| Alarm creation on down | ✅ | Integration: monitoring.test.ts |
| Alarm resolution on recovery | ✅ | Integration: monitoring.test.ts |
| EventLog creation on status change | ✅ | Integration: monitoring.test.ts |
| Notifications (webhook/Slack) | ✅ | Unit: notifications.ts |
| Real-time data via WebSocket | ✅ | Integration: websocket.test.ts, websocket-load.test.ts |

## Alarm & Event Log (3.4)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Paginated alarm list | ✅ | Integration: alarms API |
| Search by node name/IP | ✅ | Integration: nodes API search |
| Filter by status | ✅ | Integration: alarms API filter |
| Filter by date range | ✅ | Integration: alarms API filter |
| Resolve alarm with recovery note | ✅ | Integration: alarms API resolve |
| Duration auto-calculation | ✅ | Integration: monitoring.test.ts |
| Export buttons (XLSX, CSV, PDF) | ✅ | E2E: alarms.spec.ts, Integration: exports |

## History & Charts (3.5)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Node history with stats | ✅ | Integration: events history |
| Uptime/Availability calculation | ✅ | Integration: monitoring.test.ts |
| Latency line chart | ✅ | Frontend: History.tsx (Recharts) |
| Downtime Gantt chart | ✅ | Frontend: History.tsx (Recharts bar) |
| Event timeline | ✅ | Frontend: History.tsx |

## Export & Import (3.6)
| Feature | Status | Test Coverage |
|---------|--------|---------------|
| Export alarms to XLSX | ✅ | Integration: export xlsx |
| Export alarms to CSV | ✅ | Integration: export csv |
| Export alarms to PDF | ✅ | Integration: export pdf |
| Bulk import nodes from JSON | ✅ | Integration: nodes import |
| Export nodes to JSON | ✅ | Integration: nodes export |

## Performance (NFR)
| NFR | Target | Actual | Status |
|-----|--------|--------|--------|
| Login page load | < 3s | 421ms | ✅ |
| Dashboard render | < 3s | 160ms | ✅ |
| Topology render | < 5s | 435ms | ✅ |
| Alarms render | < 5s | 271ms | ✅ |
| WS event delivery latency | < 100ms | avg 0.3ms, max 1ms | ✅ |
| 50 concurrent WS clients | all deliver | 50/50 | ✅ |
| Burst 100 events × 20 clients | > 95% | 2000/2000 (100%) | ✅ |
| API concurrency (50x) | < 500ms avg | avg 113ms | ✅ |
| API pagination (20x) | < 500ms avg | avg 17ms | ✅ |

## Device Types Supported
| Type | Icon Color | Status |
|------|-----------|--------|
| Router | Indigo | ✅ |
| Switch | Cyan | ✅ |
| Firewall | Red | ✅ |
| Server | Purple | ✅ |
| OLT | Amber | ✅ |
| AP | Emerald | ✅ |
| Modem | Slate | ✅ |
| UPS | Teal | ✅ |

## Edge Cases Verified
| Case | Status |
|------|--------|
| Empty alarm list (no data) | ✅ (returns empty array + total 0) |
| Node not found (404) | ✅ |
| Duplicate username (409) | ✅ |
| Missing required fields (400) | ✅ |
| Unauthorized access (401) | ✅ |
| Forbidden role (403) | ✅ |
| Pagination overflow | ✅ (page=999 returns empty) |
| Bulk import with alt field names | ✅ (Nama_Node, IP_Address, etc.) |
| Auto-create notification defaults | ✅ (GET creates if missing) |

Legend: ✅ = Verified
