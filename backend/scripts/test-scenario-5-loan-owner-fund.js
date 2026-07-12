const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function getStateFilePath(tag) {
  return path.join(__dirname, `.scenario5-state-${tag}.json`);
}

function saveState(tag, state) {
  fs.writeFileSync(getStateFilePath(tag), JSON.stringify(state, null, 2), 'utf8');
}

function loadState(tag) {
  const filePath = getStateFilePath(tag);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deleteState(tag) {
  const filePath = getStateFilePath(tag);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function loadMongoUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const envContent = fs.readFileSync(candidate, 'utf8');
    const line = envContent
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('MONGODB_URI='));

    if (line) {
      return line.slice('MONGODB_URI='.length).trim();
    }
  }

  return 'mongodb://127.0.0.1:27017/management-system';
}

async function withDb(work) {
  await mongoose.connect(loadMongoUri(), {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    return await work(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

async function setup(tag) {
  const now = new Date();

  return withDb(async (db) => {
    const fundingSources = db.collection('fundingsources');
    const ownerFundAccounts = db.collection('owner_fund_accounts');

    const activeBankAccounts = await fundingSources.find({ type: 'bank_account', isActive: true }).toArray();
    const activeOwnerFundAccount = await ownerFundAccounts.findOne({ isActive: true });

    let insertedOwnerFundAccountId = null;

    if (!activeOwnerFundAccount) {
      const insertedOwnerFundAccount = await ownerFundAccounts.insertOne({
        name: `Scenario 5 Owner Fund ${tag}`,
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalReturnedToCompany: 0,
        bankAccount: '',
        bankName: '',
        bankAccountName: '',
        isActive: true,
        notes: `scenario-5-${tag}`,
        createdAt: now,
        updatedAt: now,
      });
      insertedOwnerFundAccountId = String(insertedOwnerFundAccount.insertedId);
    }

    saveState(tag, {
      bankAccounts: activeBankAccounts.map((account) => ({
        id: String(account._id),
        availableBalance: account.availableBalance || 0,
      })),
      ownerFundAccount: activeOwnerFundAccount
        ? {
            id: String(activeOwnerFundAccount._id),
            balance: activeOwnerFundAccount.balance || 0,
          }
        : null,
      insertedOwnerFundAccountId,
    });

    return {
      ok: true,
      tag,
      insertedOwnerFundAccountId,
    };
  });
}

async function topupOwnerFund(tag, amount) {
  return withDb(async (db) => {
    const ownerFundAccounts = db.collection('owner_fund_accounts');
    const account = await ownerFundAccounts.findOne({ isActive: true });

    if (!account) {
      throw new Error('No active owner fund account found');
    }

    await ownerFundAccounts.updateOne(
      { _id: account._id },
      {
        $inc: { balance: amount },
        $set: { updatedAt: new Date() },
      },
    );

    const updated = await ownerFundAccounts.findOne({ _id: account._id });
    return {
      ok: true,
      tag,
      ownerFundAccountId: String(account._id),
      balance: updated?.balance || 0,
    };
  });
}

async function teardown(tag) {
  const state = loadState(tag);

  return withDb(async (db) => {
    const fundingSources = db.collection('fundingsources');
    const ownerFundAccounts = db.collection('owner_fund_accounts');
    const loanContracts = db.collection('loancontracts');
    const loanRepayments = db.collection('loanrepayments');
    const cashflowEntries = db.collection('cashflowentries');
    const fundTransactions = db.collection('fund_transactions');

    const loans = await loanContracts.find({ notes: `SCENARIO5-${tag}` }).toArray();
    const loanIds = loans.map((loan) => String(loan._id));
    const repayments = loanIds.length > 0
      ? await loanRepayments.find({ loanId: { $in: loanIds } }).toArray()
      : [];
    const repaymentIds = repayments.map((repayment) => String(repayment._id));

    if (repaymentIds.length > 0) {
      await loanRepayments.deleteMany({ _id: { $in: repayments.map((repayment) => repayment._id) } });
      await fundTransactions.deleteMany({
        $or: [
          { referenceId: { $in: repaymentIds } },
          { reference: { $in: repaymentIds.map((id) => `LOAN_REPAYMENT_${id}`) } },
        ],
      });
    }

    if (loanIds.length > 0) {
      await cashflowEntries.deleteMany({
        $or: [
          { referenceId: { $in: loanIds } },
          { referenceId: { $in: repaymentIds } },
        ],
      });
      await loanContracts.deleteMany({ _id: { $in: loans.map((loan) => loan._id) } });
    }

    if (state) {
      if (Array.isArray(state.bankAccounts) && state.bankAccounts.length > 0) {
        await fundingSources.bulkWrite(
          state.bankAccounts.map((account) => ({
            updateOne: {
              filter: { _id: new mongoose.Types.ObjectId(account.id) },
              update: {
                $set: {
                  availableBalance: account.availableBalance || 0,
                  updatedAt: new Date(),
                },
              },
            },
          })),
        );
      }

      if (state.ownerFundAccount) {
        await ownerFundAccounts.updateOne(
          { _id: new mongoose.Types.ObjectId(state.ownerFundAccount.id) },
          {
            $set: {
              balance: state.ownerFundAccount.balance || 0,
              updatedAt: new Date(),
            },
          },
        );
      }

      if (state.insertedOwnerFundAccountId) {
        await ownerFundAccounts.deleteOne({ _id: new mongoose.Types.ObjectId(state.insertedOwnerFundAccountId) });
      }

      deleteState(tag);
    }

    return {
      ok: true,
      tag,
      deletedLoans: loanIds.length,
      deletedRepayments: repaymentIds.length,
    };
  });
}

async function main() {
  const action = process.argv[2];
  const tag = process.argv[3];
  const amount = Number(process.argv[4] || 0);

  if (!action || !tag) {
    throw new Error('Usage: node test-scenario-5-loan-owner-fund.js <setup|topup-owner-fund|teardown> <tag> [amount]');
  }

  let result;
  if (action === 'setup') {
    result = await setup(tag);
  } else if (action === 'topup-owner-fund') {
    result = await topupOwnerFund(tag, amount);
  } else if (action === 'teardown') {
    result = await teardown(tag);
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});