export function texlexFirstNameVoiceBlock(clientFirstName: string): string {
  const name = clientFirstName.trim() || "[CLIENT_FIRST_NAME]";
  return `IMPORTANT VOICE INSTRUCTION: Refer to the client by their first name throughout the narrative output. The first name is ${name}. Do NOT use "the client", "this client", "the child", or similar impersonal constructions. Every reference to the subject of this assessment must use their first name or a pronoun (he/she/they). Example: "${name} demonstrates..." not "The client demonstrates...".`;
}
