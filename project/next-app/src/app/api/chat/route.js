import Groq from "groq-sdk";

export async function POST(request) {
  try {
    const { question, documents } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ answer: "Error: Missing GROQ_API_KEY in your .env file." }), { status: 200 });
    }

    const groq = new Groq({ apiKey });
    
    const tools = [ { type: "function", function: { name: "submit_answer", description: "Submit your final synthesized answer and citations.", parameters: { type: "object", properties: { answer: { type: "string", description: "Your detailed text answer." }, citations: { type: "array", description: "Array of exact quotes used from the documents.", items: { type: "object", properties: { quote: { type: "string", description: "The EXACT string you copied from the document." }, documentName: { type: "string", description: "The name of the document." } }, required: ["quote", "documentName"] } } }, required: ["answer", "citations"] } } } ];

    let contextDocs = documents.map(d => `Document Name: ${d.name}\n\nContent:\n${d.extracted_text}`).join('\n\n---\n\n');

    let messages = [
      { 
          role: "system", 
          content: `You are an expert legal AI assistant. Your goal is to answer the user's question accurately based ONLY on the provided documents.

CRITICAL RULES:
- If the answer is not in the document, you MUST say so in your final answer instead of inventing or hallucinating one.
- You MUST call the \`submit_answer\` tool to provide your answer.
- Never output the answer as plain text.

DOCUMENTS TO ANALYZE:
${contextDocs}`
      },
      { role: "user", content: question }
    ];

    let finalAnswerText = "";
    
    const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b", 
        messages: messages,
        tools: tools,
        tool_choice: { type: "function", function: { name: "submit_answer" } }
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
            if (call.function.name === 'submit_answer') {
                let args;
                try { args = JSON.parse(call.function.arguments); } catch(e) { args = {}; }
                
                finalAnswerText = args.answer || "";
                const finalCitations = (args.citations || []).map((cit, idx) => {
                    const doc = documents.find(d => d.name === cit.documentName) || documents[0];
                    const normalize = (val) => (val||'').toLowerCase().replace(/\s+/g, ' ').trim();
                    const isVerified = doc ? normalize(doc.extracted_text).includes(normalize(cit.quote)) : false;
                    
                    return {
                        id: `api-cit-${Date.now()}-${idx}`,
                        documentId: doc ? doc.id : 'unknown',
                        documentName: cit.documentName,
                        quote: cit.quote,
                        verified: isVerified,
                        start: 0
                    };
                });
                
                return new Response(JSON.stringify({ answer: finalAnswerText, citations: finalCitations }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }
    } else {
        finalAnswerText = responseMessage.content || "";
        return new Response(JSON.stringify({ answer: finalAnswerText, citations: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!finalAnswerText) {
        return new Response(JSON.stringify({ 
            answer: "The AI searched the document several times but couldn't find a definitive answer. Please try rephrasing your question.",
            citations: [] 
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error("Groq API Error:", error);
    return new Response(JSON.stringify({ answer: `Error: ${error.message}` }), { status: 500 });
  }
}
