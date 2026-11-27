export class ModelOutputError extends Error {}

export async function requestStructuredOutput(input, {
  provider, apiKey, model, signal, transport = fetch, instructions, maxOutputTokens, name, schema, chat, temperature = 0,
}) {
  const deepseek = provider === 'deepseek';
  const chatMode = deepseek && chat;
  const url = chatMode ? 'https://api.deepseek.com/chat/completions'
    : deepseek ? 'https://api.deepseek.com/responses' : 'https://api.openai.com/v1/responses';
  const format = { type: 'json_schema', name, schema, ...(deepseek ? {} : { strict: true }) };
  const response = await transport(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(chatMode ? {
      model, max_tokens: maxOutputTokens, temperature, stream: false,
      thinking: { type: 'disabled' }, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(input) }],
    } : {
      model, max_output_tokens: maxOutputTokens,
      ...(deepseek ? { reasoning: { effort: 'none' } } : { store: false }),
      instructions,
      input: JSON.stringify(input),
      text: { format },
    }),
    signal,
  });
  if (!response.ok) throw new Error('Provider HTTP ' + response.status);
  const result = await response.json();
  if (chatMode) {
    const choice = result.choices?.[0];
    if (choice?.finish_reason === 'length') throw new ModelOutputError('Output token limit reached');
    if (choice?.finish_reason !== 'stop') throw new ModelOutputError('Model did not complete');
    if (typeof choice.message?.content !== 'string' || !choice.message.content.trim()) {
      throw new ModelOutputError('Model returned empty content');
    }
    try {
      return JSON.parse(choice.message.content);
    } catch {
      throw new ModelOutputError('Model returned invalid JSON');
    }
  }
  if (result.status !== 'completed' || !Array.isArray(result.output)) throw new Error('Incomplete model response.');
  const items = result.output.filter((item) => item.type === 'message' && item.role === 'assistant')
    .flatMap((item) => item.content ?? []);
  if (items.some((item) => item.type === 'refusal')) throw new Error('Model declined.');
  return JSON.parse(items.filter(({ type }) => type === 'output_text').map(({ text }) => text).join(''));
}
