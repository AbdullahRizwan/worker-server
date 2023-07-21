export const generate_emails = (first_name, middle_name, last_name, domain) => {
    
    const permutations = ['{fn}', '{fn}.{ln}', '{fi}{ln}', '{ln}', '{fn}{ln}', '{fi}.{ln}', '{fn}{li}', '{fi}{li}', '{fn}.{li}', '{fi}.{li}', '{li}{fi}', '{ln}{fi}', '{li}.{fi}', '{ln}.{fi}', '{li}{fn}', '{li}.{fn}', '{ln}.{fn}', '{ln}{fn}', '{fn}_{li}', '{li}_{fi}', '{ln}_{fi}', '{fn}_{ln}', '{fn}-{ln}', '{fi}_{li}', '{li}-{fn}', '{fi}-{ln}', '{ln}_{fn}', '{fn}-{li}', '{li}-{fi}', '{fi}_{ln}', '{li}_{fn}', '{fi}-{li}', '{ln}-{fi}', '{ln}-{fn}', '{fn}.{mn}.{ln}', '{fn}.{mi}.{ln}', '{fn}{mn}{ln}', '{fi}{mi}.{ln}', '{fn}_{mn}_{ln}', '{fi}{mi}{ln}', '{fn}-{mi}-{ln}', '{fn}{mi}{ln}', '{fi}{mi}_{ln}', '{fi}{mi}-{ln}', '{fn}_{mi}_{ln}', '{fn}-{mn}-{ln}'];

    const fn = first_name.toLowerCase();
    const ln = last_name.toLowerCase();
    const mn = middle_name.toLowerCase();
    const fi = fn.charAt(0);
    const li = ln.charAt(0);
    const mi = mn.charAt(0);

    return permutations.map((permutation) => {
        return permutation.replace('{fn}', fn).replace('{ln}', ln).replace('{mn}', mn).replace('{fi}', fi).replace('{li}', li).replace('{mi}', mi);
    }).map((email) => {
        return email + '@' + domain;
    });
}

