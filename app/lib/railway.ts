const RAILWAY_GQL = 'https://backboard.railway.app/graphql/v2'

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const resp = await fetch(RAILWAY_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RAILWAY_TOKEN!}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`Railway error: ${resp.status}`)
  const json = await resp.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

export async function startEventWorker(vars: {
  eventId: string
  roomName: string
  langCodesCsv: string
  mode: 'captions' | 'audio' | 'both'
}) {
  const serviceId = process.env.WORKER_SERVICE_ID!

  await gql(`
    mutation UpsertVariables($serviceId: String!, $vars: [VariableInput!]!) {
      variablesUpsert(serviceId: $serviceId, variables: $vars) { id }
    }
  `, {
    serviceId,
    vars: [
      { name: 'EVENT_ID', value: vars.eventId },
      { name: 'ROOM_NAME', value: vars.roomName },
      { name: 'LANG_CODES', value: vars.langCodesCsv },
      { name: 'MODE', value: vars.mode },
    ],
  })

  await gql(`
    mutation Scale($serviceId: String!, $replicas: Int!) {
      serviceInstanceScale(serviceId: $serviceId, replicas: $replicas) { id }
    }
  `, { serviceId, replicas: 1 })
}

export async function stopEventWorker() {
  const serviceId = process.env.WORKER_SERVICE_ID!
  await gql(`
    mutation Scale($serviceId: String!, $replicas: Int!) {
      serviceInstanceScale(serviceId: $serviceId, replicas: $replicas) { id }
    }
  `, { serviceId, replicas: 0 })
}
