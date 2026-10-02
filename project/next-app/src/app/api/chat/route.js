import Groq from "groq-sdk";

export async function POST(request) {
  try {
    const { question, documents } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ answer: "Error: Missing GROQ_API_KEY in your .env file." }), { status: 200 });
    }

    const groq = new Groq({ apiKey });
    
    // Tools array formatted for Groq / OpenAI
    const tools = [
      {
        type: "function",
        function: {
          name: "search_document",
          description: "Search the legal documents for a specific exact phrase or keyword. Returns matching paragraphs.",
          parameters: {
            type: "object",
            properties: { 
                query: { type: "string", description: "The keyword or phrase to search for." } 
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_clauses",
          description: "Get a list of all major clause headings in the document to understand its structure.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      }
    ];

    let messages = [
      { 
          role: "system", 
          content: "You are an expert legal AI assistant. Your goal is to answer the user's question accurately. Use your tools (search_document, list_clauses) to read the user's documents before answering. You MUST use tools to find specific facts.\n\nCRITICAL RULES:\n- If the answer is not in the document, you MUST say so instead of inventing or hallucinating one.\n- When you are ready to give your final answer (i.e. you are no longer calling tools), you MUST output valid JSON containing:\n  1. 'answer': Your detailed text answer.\n  2. 'citations': An array of objects, each containing 'quote' (the EXACT string you copied from the document) and 'documentName' (the name of the document it came from)." 
      },
      { 
          role: "user", 
          content: question 
      }
    ];

    let finalAnswerText = "";
    let loopCount = 0;

    // The Agentic Loop: Keep executing tools as long as the AI asks for them
    while (loopCount < 5) {
        const response = await groq.chat.completions.create({
            // Using currently supported 2026 GPT model on Groq
            model: "openai/gpt-oss-120b", 
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            response_format: { type: "json_object" }
        });

        const responseMessage = response.choices[0].message;
        const toolCalls = responseMessage.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            messages.push(responseMessage); // Add assistant message with tool_calls
            
            for (const call of toolCalls) {
                let functionResponse = {};
                let args;
                try { 
                    args = JSON.parse(call.function.arguments); 
                } catch(e) { 
                    args = {}; 
                }

                if (call.function.name === 'search_document') {
                    const query = (args.query || "").toLowerCase();
                    const matches = [];
                    for (const doc of documents) {
                        const blocks = doc.extracted_text.split('\n\n').filter(p => p.trim());
                        for (const block of blocks) {
                            if (block.toLowerCase().includes(query)) {
                                matches.push(`[${doc.name}]: ${block}`);
                            }
                        }
                    }
                    functionResponse = { matches: matches.length ? matches.slice(0, 10) : ["No matches found."] };
                } 
                else if (call.function.name === 'list_clauses') {
                    const clauses = [];
                    for (const doc of documents) {
                        const matches = doc.extracted_text.match(/^(\d+\.\s+[^\n]+)/gm);
                        if (matches) clauses.push(`[${doc.name}]:\n${matches.join('\n')}`);
                    }
                    functionResponse = { clauses: clauses.length ? clauses : ["No numbered clauses found."] };
                }

                messages.push({
                    tool_call_id: call.id,
                    role: "tool",
                    name: call.function.name,
                    content: JSON.stringify(functionResponse),
                });
            }
            loopCount++;
        } else {
            // No more tool calls, we have our final synthesized answer in JSON format
            const rawOutput = responseMessage.content;
            try {
                let parsed = JSON.parse(rawOutput);
                finalAnswerText = parsed.answer || rawOutput;
                
                // Map the citations so the frontend can display them properly
                const finalCitations = (parsed.citations || []).map((cit, idx) => {
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
                
                return new Response(JSON.stringify({ 
                    answer: finalAnswerText,
                    citations: finalCitations
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (e) {
                console.error("Failed to parse AI JSON output:", e);
                return new Response(JSON.stringify({ 
                    answer: rawOutput,
                    citations: [] 
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }
    }

    if (!finalAnswerText) {
        throw new Error("Agentic loop failed to produce a final answer.");
    }
  } catch (error) {
    console.error("Groq API Error:", error);
    return new Response(JSON.stringify({ answer: `Error: ${error.message}` }), { status: 500 });
  }
}
