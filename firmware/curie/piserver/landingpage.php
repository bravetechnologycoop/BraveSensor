<?php
$db_name = 'testdb';
$db_user = 'brave';
$db_password = 'brave';
$db_host = 'localhost';

try {
    try {
        $pdo = new PDO("pgsql:host=$db_host;dbname=$db_name", $db_user, $db_password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        //echo "Connected successfully!";
    } catch (PDOException $e) {
        echo "Database connection failed: " . $e->getMessage();
    }
    if (isset($_POST['in'])) {
        $stmt = $pdo->prepare("SELECT count FROM counter ORDER BY epochtime DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $current_count = $row['count'];

        $new_count = $current_count + 1;
        $stmt = $pdo->prepare("INSERT INTO counter (count) VALUES (:new_count)");
        $stmt->bindParam(':new_count', $new_count);
        $stmt->execute();
    }

    if (isset($_POST['out'])) {
        $stmt = $pdo->prepare("SELECT count FROM counter ORDER BY epochtime DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $current_count = $row['count'];

        $new_count = $current_count - 1;
        $stmt = $pdo->prepare("INSERT INTO counter (count) VALUES (:new_count)");
        $stmt->bindParam(':new_count', $new_count);
        $stmt->execute();
    }
    $stmt = $pdo->prepare("SELECT count, epochtime FROM counter ORDER BY epochtime DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $current_count = $row['count'];
    $epochtime = $row['epochtime'];
    $stmt = $pdo->prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    $stmt->execute();
    $tables = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $selected_table = null;
    $table_data = null;
    if (isset($_POST['table'])) {
        $selected_table = $_POST['table'];
        $stmt = $pdo->prepare("SELECT * FROM $selected_table LIMIT 10");
        $stmt->execute();
        $table_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

} catch (PDOException $e) {
    echo 'Database error: ' . $e->getMessage();
}
?>

<html>
<head>
    <title>Web Interface</title>
</head>
<body>
    <h1 align="center">Bathroom Counter</h1>
    <h2 align="center">Current Count: <?php echo $current_count; ?></h2>
    <h3 align="center">Last Updated: <?php echo $epochtime; ?></h3>

    <div style="text-align: center;">
        <form method="POST">
            <button type="submit" name="in">IN</button>
            <button type="submit" name="out">OUT</button>
        </form>
    </div>

    <br>
    <div style="text-align: center;">
        <form method="POST">
            <label for="table">Select Table:</label>
            <select id="table" name="table" onchange="this.form.submit()">
                <option value="">--Select a Table--</option>
                <?php foreach ($tables as $table): ?>
                    <option value="<?php echo $table['table_name']; ?>" <?php echo ($selected_table == $table['table_name']) ? 'selected' : ''; ?>>
                        <?php echo $table['table_name']; ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </form>
    </div>

    <?php if ($selected_table): ?>
        <h2 align="center">Data from Table: <?php echo htmlspecialchars($selected_table); ?></h2>
        <div style="text-align: center;">
            <?php
            if ($table_data) {
                echo "<table border='1' style='margin: 20px auto;'><tr>";
                foreach (array_keys($table_data[0]) as $column) {
                    echo "<th>" . htmlspecialchars($column) . "</th>";
                }
                echo "</tr>";
                foreach ($table_data as $row) {
                    echo "<tr>";
                    foreach ($row as $value) {
                        echo "<td>" . htmlspecialchars($value) . "</td>";
                    }
                    echo "</tr>";
                }
                echo "</table>";
            } else {
                echo "No data available for this table.";
            }
            ?>
        </div>
    <?php endif; ?>
</body>
</html>
